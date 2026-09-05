import crypto from "crypto";
import Razorpay from "razorpay";
import mongoose from "mongoose";

import Payment from "../models/Payment.js";
import Booking from "../models/Booking.js";

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function getRequiredEnv(name) {
  const value = String(
    process.env[name] || ""
  ).trim();

  if (!value) {
    const error = new Error(
      `${name} is not configured.`
    );

    error.statusCode = 500;

    throw error;
  }

  return value;
}

function getCurrency() {
  const currency = String(
    process.env.PAYMENT_CURRENCY || "INR"
  )
    .trim()
    .toUpperCase();

  if (!/^[A-Z]{3}$/.test(currency)) {
    const error = new Error(
      "PAYMENT_CURRENCY must be a valid 3-letter currency code."
    );

    error.statusCode = 500;

    throw error;
  }

  return currency;
}

function getRazorpayClient() {
  return new Razorpay({
    key_id: getRequiredEnv(
      "RAZORPAY_KEY_ID"
    ),

    key_secret: getRequiredEnv(
      "RAZORPAY_KEY_SECRET"
    )
  });
}

function normalizeText(
  value,
  maxLength = 2000
) {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
}

function safeTimingCompare(
  received,
  expected
) {
  const receivedBuffer = Buffer.from(
    String(received || ""),
    "utf8"
  );

  const expectedBuffer = Buffer.from(
    String(expected || ""),
    "utf8"
  );

  if (
    receivedBuffer.length !==
    expectedBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    receivedBuffer,
    expectedBuffer
  );
}

function isAdmin(req) {
  return req.user?.role === "admin";
}

function isCustomer(
  req,
  booking
) {
  return (
    req.user?.role === "customer" &&
    String(booking.customerId) ===
      String(req.user.id)
  );
}

function canAccessBooking(
  req,
  booking
) {
  if (isAdmin(req)) {
    return true;
  }

  return isCustomer(
    req,
    booking
  );
}

function toPaise(amount) {
  const numericAmount = Number(
    amount
  );

  if (
    !Number.isFinite(
      numericAmount
    ) ||
    numericAmount <= 0
  ) {
    return null;
  }

  const paise = Math.round(
    numericAmount * 100
  );

  if (
    !Number.isSafeInteger(
      paise
    ) ||
    paise < 100
  ) {
    return null;
  }

  return paise;
}

function makeReceipt(
  bookingId
) {
  const clean = String(
    bookingId || ""
  ).replace(
    /[^a-zA-Z0-9_-]/g,
    ""
  );

  const suffix = Date.now()
    .toString(36);

  return `SWN-${clean}-${suffix}`
    .slice(0, 40);
}

function sanitizePayment(
  payment
) {
  if (!payment) {
    return payment;
  }

  const data =
    payment.toObject
      ? payment.toObject()
      : {
          ...payment
        };

  delete data.gatewaySignature;
  delete data.processedWebhookEvents;

  return data;
}

async function populatePayment(
  payment
) {
  return Payment.findById(
    payment._id
  )
    .populate(
      "bookingId",
      "jobId customerId workerId status date notes customerMessage workerMessage"
    )
    .populate(
      "userId",
      "name email phone"
    );
}

function isDuplicateKeyError(
  error
) {
  return (
    error?.code === 11000 ||
    (
      error?.name ===
        "MongoServerError" &&
      error?.code === 11000
    )
  );
}

async function findActiveRazorpayPayment(
  booking
) {
  return Payment.findOne({
    bookingId:
      booking._id,

    userId:
      booking.customerId,

    method:
      "razorpay",

    status: {
      $in: [
        "created",
        "pending",
        "processing"
      ]
    }
  }).sort({
    createdAt: -1
  });
}

/*
==================================================
CREATE RAZORPAY ORDER
==================================================
*/

export async function createRazorpayOrder(
  req,
  res
) {
  let reservation = null;
  let razorpayOrderCreated = false;

  try {
    const {
      bookingId
    } = req.body || {};

    if (
      !isValidId(bookingId)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Valid booking ID is required."
      });
    }

    const booking =
      await Booking.findById(
        bookingId
      ).populate(
        "jobId",
        "title budget customerId status"
      );

    if (!booking) {
      return res.status(404).json({
        success: false,
        message:
          "Booking not found."
      });
    }

    if (
      !canAccessBooking(
        req,
        booking
      )
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to pay for this booking."
      });
    }

    if (
      ![
        "accepted",
        "confirmed"
      ].includes(
        booking.status
      )
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Payment is available only after the worker accepts the booking."
      });
    }

    if (
      !booking.jobId
    ) {
      return res.status(409).json({
        success: false,
        message:
          "The job associated with this booking was not found."
      });
    }

    const budget = Number(
      booking.jobId.budget
    );

    const amount =
      toPaise(budget);

    if (
      amount === null
    ) {
      return res.status(409).json({
        success: false,
        message:
          "This booking does not have a valid payable amount."
      });
    }

    const currency =
      getCurrency();

    const existingPayment =
      await findActiveRazorpayPayment(
        booking
      );

    if (
      existingPayment
    ) {
      if (
        !existingPayment.razorpayOrderId
      ) {
        return res.status(409).json({
          success: false,
          message:
            "A payment order is currently being created. Please try again shortly."
        });
      }

      if (
        Number(
          existingPayment.amount
        ) !== amount ||
        String(
          existingPayment.currency
        )
          .toUpperCase() !==
          currency
      ) {
        return res.status(409).json({
          success: false,
          message:
            "An active payment order exists with different payment details. Please contact support."
        });
      }

      return res.status(200).json({
        success: true,
        message:
          "Existing Razorpay order returned.",

        data: {
          payment:
            sanitizePayment(
              existingPayment
            ),

          order: {
            id:
              existingPayment.razorpayOrderId,

            amount:
              existingPayment.amount,

            currency:
              existingPayment.currency
          }
        }
      });
    }

    try {
      reservation =
        await Payment.create({
          userId:
            booking.customerId,

          bookingId:
            booking._id,

          amount,

          currency,

          method:
            "razorpay",

          status:
            "processing",

          razorpayOrderId:
            null,

          notes:
            "Smart Work Network Razorpay payment"
        });
    } catch (error) {
      if (
        isDuplicateKeyError(
          error
        )
      ) {
        const duplicate =
          await findActiveRazorpayPayment(
            booking
          );

        if (
          duplicate?.razorpayOrderId
        ) {
          return res.status(200).json({
            success: true,
            message:
              "Existing Razorpay order returned.",

            data: {
              payment:
                sanitizePayment(
                  duplicate
                ),

              order: {
                id:
                  duplicate.razorpayOrderId,

                amount:
                  duplicate.amount,

                currency:
                  duplicate.currency
              }
            }
          });
        }

        return res.status(409).json({
          success: false,
          message:
            "A payment order is already being created. Please try again shortly."
        });
      }

      throw error;
    }

    const razorpay =
      getRazorpayClient();

    const order =
      await razorpay.orders.create({
        amount,

        currency,

        receipt:
          makeReceipt(
            booking._id
          ),

        notes: {
          bookingId:
            String(
              booking._id
            ),

          customerId:
            String(
              booking.customerId
            )
        }
      });

    if (
      !order?.id
    ) {
      throw new Error(
        "Razorpay did not return an order ID."
      );
    }

    razorpayOrderCreated =
      true;

    reservation.razorpayOrderId =
      String(order.id);

    reservation.status =
      "created";

    await reservation.save();

    return res.status(201).json({
      success: true,

      message:
        "Razorpay order created successfully.",

      data: {
        payment:
          sanitizePayment(
            reservation
          ),

        order: {
          id:
            order.id,

          amount:
            order.amount,

          currency:
            order.currency
        }
      }
    });
  } catch (error) {
    console.error(
      "CREATE RAZORPAY ORDER ERROR:",
      error
    );

    if (
      reservation?._id
    ) {
      try {
        if (
          !razorpayOrderCreated
        ) {
          await Payment.findOneAndUpdate(
            {
              _id:
                reservation._id,

              status:
                "processing",

              razorpayOrderId:
                null
            },
            {
              $set: {
                status:
                  "failed",

                failedAt:
                  new Date()
              }
            }
          );
        }
      } catch (
        rollbackError
      ) {
        console.error(
          "PAYMENT RESERVATION ROLLBACK ERROR:",
          rollbackError
        );
      }
    }

    return res.status(
      error.statusCode || 500
    ).json({
      success: false,
      message:
        error.statusCode
          ? error.message
          : "Unable to create Razorpay order."
    });
  }
}

/*
==================================================
VERIFY RAZORPAY PAYMENT
==================================================
*/

export async function verifyRazorpayPayment(
  req,
  res
) {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body || {};

    const orderId =
      String(
        razorpay_order_id || ""
      ).trim();

    const paymentId =
      String(
        razorpay_payment_id || ""
      ).trim();

    const signature =
      String(
        razorpay_signature || ""
      ).trim();

    if (
      !orderId ||
      !paymentId ||
      !signature
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Razorpay payment verification details are required."
      });
    }

    if (
      orderId.length > 100 ||
      paymentId.length > 100 ||
      signature.length > 200
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid Razorpay payment verification data."
      });
    }

    const payment =
      await Payment.findOne({
        razorpayOrderId:
          orderId
      }).select(
        "+gatewaySignature"
      );

    if (!payment) {
      return res.status(404).json({
        success: false,
        message:
          "Payment order not found."
      });
    }

    const booking =
      await Booking.findById(
        payment.bookingId
      );

    if (!booking) {
      return res.status(404).json({
        success: false,
        message:
          "Booking associated with payment was not found."
      });
    }

    if (
      !canAccessBooking(
        req,
        booking
      )
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to verify this payment."
      });
    }

    if (
      payment.status ===
      "paid"
    ) {
      if (
        String(
          payment.gatewayPaymentId
        ) === paymentId
      ) {
        return res.status(200).json({
          success: true,
          message:
            "Payment was already verified.",

          data: {
            payment:
              sanitizePayment(
                payment
              ),

            booking: {
              id:
                booking._id,

              status:
                booking.status,

              confirmedAt:
                booking.confirmedAt
            }
          }
        });
      }

      return res.status(409).json({
        success: false,
        message:
          "This payment order has already been completed with a different payment."
      });
    }

    if (
      [
        "failed",
        "cancelled",
        "refunded"
      ].includes(
        payment.status
      )
    ) {
      return res.status(409).json({
        success: false,
        message:
          "This payment is no longer available for verification."
      });
    }

    const secret =
      getRequiredEnv(
        "RAZORPAY_KEY_SECRET"
      );

    const generatedSignature =
      crypto
        .createHmac(
          "sha256",
          secret
        )
        .update(
          `${orderId}|${paymentId}`,
          "utf8"
        )
        .digest("hex");

    const validSignature =
      safeTimingCompare(
        signature,
        generatedSignature
      );

    if (
      !validSignature
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid Razorpay payment signature."
      });
    }

    if (
      String(
        payment.razorpayOrderId
      ) !== orderId
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Razorpay order mismatch."
      });
    }

    const razorpay =
      getRazorpayClient();

    let gatewayPayment;

    try {
      gatewayPayment =
        await razorpay.payments.fetch(
          paymentId
        );
    } catch (
      gatewayError
    ) {
      console.error(
        "RAZORPAY PAYMENT FETCH ERROR:",
        gatewayError
      );

      return res.status(502).json({
        success: false,
        message:
          "Unable to verify payment with Razorpay. Please try again."
      });
    }

    if (
      !gatewayPayment?.id
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Razorpay returned an invalid payment record."
      });
    }

    if (
      String(
        gatewayPayment.id
      ) !== paymentId
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Razorpay payment ID mismatch."
      });
    }

    if (
      String(
        gatewayPayment.order_id || ""
      ) !== orderId
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Razorpay payment does not belong to this order."
      });
    }

    if (
      String(
        gatewayPayment.order_id || ""
      ) !==
      String(
        payment.razorpayOrderId
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Payment order does not match the stored payment."
      });
    }

    const gatewayAmount =
      Number(
        gatewayPayment.amount
      );

    const databaseAmount =
      Number(
        payment.amount
      );

    if (
      !Number.isSafeInteger(
        gatewayAmount
      ) ||
      gatewayAmount <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Razorpay returned an invalid payment amount."
      });
    }

    if (
      gatewayAmount !==
      databaseAmount
    ) {
      console.error(
        "RAZORPAY AMOUNT MISMATCH:",
        {
          paymentId,
          orderId,
          gatewayAmount,
          databaseAmount
        }
      );

      return res.status(400).json({
        success: false,
        message:
          "Payment amount verification failed."
      });
    }

    const databaseCurrency =
      String(
        payment.currency || ""
      )
        .trim()
        .toUpperCase();

    const gatewayCurrency =
      String(
        gatewayPayment.currency || ""
      )
        .trim()
        .toUpperCase();

    if (
      !databaseCurrency ||
      !gatewayCurrency ||
      databaseCurrency !==
        gatewayCurrency
    ) {
      console.error(
        "RAZORPAY CURRENCY MISMATCH:",
        {
          paymentId,
          orderId,
          gatewayCurrency,
          databaseCurrency
        }
      );

      return res.status(400).json({
        success: false,
        message:
          "Payment currency verification failed."
      });
    }

    const gatewayStatus =
      String(
        gatewayPayment.status || ""
      )
        .trim()
        .toLowerCase();

    if (
      gatewayStatus !==
      "captured"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Payment has not been captured by Razorpay yet."
      });
    }

    const paymentAlreadyUsed =
      await Payment.findOne({
        gatewayPaymentId:
          paymentId,

        _id: {
          $ne:
            payment._id
        }
      }).select(
        "_id bookingId status"
      );

    if (
      paymentAlreadyUsed
    ) {
      console.error(
        "RAZORPAY PAYMENT ID REUSE DETECTED:",
        {
          paymentId,

          currentPayment:
            String(
              payment._id
            ),

          existingPayment:
            String(
              paymentAlreadyUsed._id
            )
        }
      );

      return res.status(409).json({
        success: false,
        message:
          "This Razorpay payment has already been associated with another payment."
      });
    }

    const now =
      new Date();

    const claimedPayment =
      await Payment.findOneAndUpdate(
        {
          _id:
            payment._id,

          status: {
            $in: [
              "created",
              "pending",
              "processing"
            ]
          },

          $or: [
            {
              gatewayPaymentId:
                {
                  $exists: false
                }
            },

            {
              gatewayPaymentId:
                null
            },

            {
              gatewayPaymentId:
                ""
            }
          ]
        },
        {
          $set: {
            gatewayPaymentId:
              paymentId,

            gatewaySignature:
              signature,

            transactionId:
              paymentId,

            status:
              "paid",

            paidAt:
              payment.paidAt ||
              now
          }
        },
        {
          new: true
        }
      );

    if (
      !claimedPayment
    ) {
      const latestPayment =
        await Payment.findById(
          payment._id
        );

      if (
        latestPayment?.status ===
          "paid" &&
        String(
          latestPayment.gatewayPaymentId
        ) === paymentId
      ) {
        return res.status(200).json({
          success: true,
          message:
            "Payment was already verified.",

          data: {
            payment:
              sanitizePayment(
                latestPayment
              ),

            booking: {
              id:
                booking._id,

              status:
                booking.status,

              confirmedAt:
                booking.confirmedAt
            }
          }
        });
      }

      if (
        latestPayment?.status ===
          "paid" &&
        String(
          latestPayment.gatewayPaymentId
        ) !== paymentId
      ) {
        return res.status(409).json({
          success: false,
          message:
            "This payment order has already been completed with a different payment."
        });
      }

      return res.status(409).json({
        success: false,
        message:
          "Payment verification is already being processed. Please try again shortly."
      });
    }

    let finalBooking =
      booking;

    if (
      booking.status ===
      "accepted"
    ) {
      const updatedBooking =
        await Booking.findOneAndUpdate(
          {
            _id:
              booking._id,

            status:
              "accepted"
          },
          {
            $set: {
              status:
                "confirmed",

              confirmedAt:
                booking.confirmedAt ||
                now
            }
          },
          {
            new: true
          }
        );

      if (
        updatedBooking
      ) {
        finalBooking =
          updatedBooking;
      } else {
        const currentBooking =
          await Booking.findById(
            booking._id
          );

        if (
          currentBooking
        ) {
          finalBooking =
            currentBooking;
        }
      }
    }

    return res.status(200).json({
      success: true,

      message:
        "Payment verified successfully.",

      data: {
        payment:
          sanitizePayment(
            claimedPayment
          ),

        booking: {
          id:
            finalBooking._id,

          status:
            finalBooking.status,

          confirmedAt:
            finalBooking.confirmedAt
        }
      }
    });
  } catch (error) {
    console.error(
      "VERIFY RAZORPAY PAYMENT ERROR:",
      error
    );

    if (
      isDuplicateKeyError(
        error
      )
    ) {
      return res.status(409).json({
        success: false,
        message:
          "This Razorpay payment has already been processed."
      });
    }

    return res.status(
      error.statusCode || 500
    ).json({
      success: false,
      message:
        error.statusCode
          ? error.message
          : "Unable to verify payment."
    });
  }
}

/*
==================================================
GET MY PAYMENTS
==================================================
*/

export async function getMyPayments(
  req,
  res
) {
  try {
    const page =
      Math.max(
        1,
        Math.min(
          Number.parseInt(
            req.query.page,
            10
          ) || 1,
          100000
        )
      );

    const limit =
      Math.max(
        1,
        Math.min(
          Number.parseInt(
            req.query.limit,
            10
          ) || 20,
          100
        )
      );

    const skip =
      (page - 1) *
      limit;

    const filter =
      isAdmin(req)
        ? {}
        : {
            userId:
              req.user.id
          };

    const [
      payments,
      total
    ] = await Promise.all([
      Payment.find(filter)
        .sort({
          createdAt: -1
        })
        .skip(skip)
        .limit(limit)
        .populate(
          "bookingId",
          "jobId customerId workerId status date notes"
        )
        .populate(
          "userId",
          "name email phone"
        ),

      Payment.countDocuments(
        filter
      )
    ]);

    return res.status(200).json({
      success: true,

      pagination: {
        page,
        limit,
        total,
        totalPages:
          Math.max(
            1,
            Math.ceil(
              total / limit
            )
          )
      },

      count:
        payments.length,

      data:
        payments.map(
          sanitizePayment
        )
    });
  } catch (error) {
    console.error(
      "GET MY PAYMENTS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to fetch payments."
    });
  }
}

/*
==================================================
GET PAYMENT BY ID
==================================================
*/

export async function getPaymentById(
  req,
  res
) {
  try {
    const {
      id
    } = req.params;

    if (
      !isValidId(id)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid payment ID."
      });
    }

    const payment =
      await Payment.findById(
        id
      )
        .populate(
          "bookingId",
          "jobId customerId workerId status date notes"
        )
        .populate(
          "userId",
          "name email phone"
        );

    if (!payment) {
      return res.status(404).json({
        success: false,
        message:
          "Payment not found."
      });
    }

    if (
      !isAdmin(req) &&
      String(
        payment.userId?._id ||
        payment.userId
      ) !==
        String(
          req.user.id
        )
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to view this payment."
      });
    }

    return res.status(200).json({
      success: true,

      data:
        sanitizePayment(
          payment
        )
    });
  } catch (error) {
    console.error(
      "GET PAYMENT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to fetch payment."
    });
  }
}

/*
==================================================
GET ALL PAYMENTS
==================================================
*/

export async function getAllPayments(
  req,
  res
) {
  try {
    const page =
      Math.max(
        1,
        Math.min(
          Number.parseInt(
            req.query.page,
            10
          ) || 1,
          100000
        )
      );

    const limit =
      Math.max(
        1,
        Math.min(
          Number.parseInt(
            req.query.limit,
            10
          ) || 50,
          100
        )
      );

    const skip =
      (page - 1) *
      limit;

    const filter = {};

    if (
      req.query.status
    ) {
      filter.status =
        normalizeText(
          req.query.status,
          50
        ).toLowerCase();
    }

    const [
      payments,
      total
    ] = await Promise.all([
      Payment.find(filter)
        .sort({
          createdAt: -1
        })
        .skip(skip)
        .limit(limit)
        .populate(
          "bookingId",
          "jobId customerId workerId status date notes"
        )
        .populate(
          "userId",
          "name email phone"
        ),

      Payment.countDocuments(
        filter
      )
    ]);

    return res.status(200).json({
      success: true,

      pagination: {
        page,
        limit,
        total,
        totalPages:
          Math.max(
            1,
            Math.ceil(
              total / limit
            )
          )
      },

      count:
        payments.length,

      data:
        payments.map(
          sanitizePayment
        )
    });
  } catch (error) {
    console.error(
      "GET ALL PAYMENTS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to fetch all payments."
    });
  }
}

/*
==================================================
RAZORPAY WEBHOOK
==================================================

SECURITY:

1. Raw request body.
2. Webhook secret.
3. HMAC SHA-256.
4. Constant-time signature comparison.
5. Event ID extraction.
6. Atomic event idempotency.
7. Payment state transition.
8. Booking state transition.
9. Paid/refunded states are never downgraded
   by late failed/authorized events.
10. Concurrent duplicate webhook requests are
    prevented from processing the same event twice.
==================================================
*/

export async function razorpayWebhook(
  req,
  res
) {
  try {
    const signature =
      String(
        req.headers[
          "x-razorpay-signature"
        ] || ""
      ).trim();

    if (!signature) {
      return res.status(400).json({
        success: false,
        message:
          "Razorpay webhook signature is required."
      });
    }

    const secret =
      getRequiredEnv(
        "RAZORPAY_WEBHOOK_SECRET"
      );

    const rawBody =
      Buffer.isBuffer(
        req.body
      )
        ? req.body
        : Buffer.from(
            String(
              req.body || ""
            ),
            "utf8"
          );

    if (
      !rawBody.length
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Empty webhook payload."
      });
    }

    const expectedSignature =
      crypto
        .createHmac(
          "sha256",
          secret
        )
        .update(rawBody)
        .digest("hex");

    if (
      !safeTimingCompare(
        signature,
        expectedSignature
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid webhook signature."
      });
    }

    let payload;

    try {
      payload =
        JSON.parse(
          rawBody.toString(
            "utf8"
          )
        );
    } catch {
      return res.status(400).json({
        success: false,
        message:
          "Invalid webhook payload."
      });
    }

    const event =
      String(
        payload?.event || ""
      ).trim();

    const eventId =
      String(
        req.headers[
          "x-razorpay-event-id"
        ] ||
        payload?.event_id ||
        ""
      ).trim();

    if (!event) {
      return res.status(400).json({
        success: false,
        message:
          "Webhook event is required."
      });
    }

    const paymentEntity =
      payload?.payload?.payment
        ?.entity;

    const orderId =
      paymentEntity?.order_id
        ? String(
            paymentEntity.order_id
          )
        : null;

    const paymentId =
      paymentEntity?.id
        ? String(
            paymentEntity.id
          )
        : null;

    const refundEntity =
      payload?.payload?.refund
        ?.entity;

    const refundPaymentId =
      refundEntity?.payment_id
        ? String(
            refundEntity.payment_id
          )
        : null;

    const resolvedOrderId =
      orderId;

    if (
      !resolvedOrderId &&
      !refundPaymentId
    ) {
      return res.status(200).json({
        success: true,
        message:
          "Webhook received without a payment reference."
      });
    }

    /*
    ------------------------------------------------
    FIND LOCAL PAYMENT
    ------------------------------------------------
    */

    let payment = null;

    if (
      resolvedOrderId
    ) {
      payment =
        await Payment.findOne({
          razorpayOrderId:
            resolvedOrderId
        }).select(
          "+processedWebhookEvents +gatewaySignature"
        );
    }

    if (
      !payment &&
      refundPaymentId
    ) {
      payment =
        await Payment.findOne({
          gatewayPaymentId:
            refundPaymentId
        }).select(
          "+processedWebhookEvents +gatewaySignature"
        );
    }

    if (!payment) {
      /*
      Unknown payment events are acknowledged so
      Razorpay does not retry indefinitely.
      */

      return res.status(200).json({
        success: true,
        message:
          "Webhook received for an unknown payment."
      });
    }

    /*
    ------------------------------------------------
    EVENT ID REQUIREMENT
    ------------------------------------------------

    For reliable exactly-once processing, Razorpay
    event ID is required.

    If the provider does not send an event ID,
    the event is still processed safely by state
    transition rules, but cannot have true event-level
    deduplication.
    ------------------------------------------------
    */

    /*
    ------------------------------------------------
    PAYMENT.CAPTURED
    ------------------------------------------------
    */

    if (
      event ===
      "payment.captured"
    ) {
      /*
      Validate the gateway event against the local
      payment before changing local financial state.
      */

      if (
        paymentEntity
      ) {
        const gatewayAmount =
          Number(
            paymentEntity.amount
          );

        const localAmount =
          Number(
            payment.amount
          );

        if (
          !Number.isSafeInteger(
            gatewayAmount
          ) ||
          gatewayAmount <= 0 ||
          gatewayAmount !==
            localAmount
        ) {
          console.error(
            "WEBHOOK CAPTURED AMOUNT MISMATCH:",
            {
              eventId,
              paymentId,
              orderId,
              gatewayAmount,
              localAmount
            }
          );

          return res.status(400).json({
            success: false,
            message:
              "Webhook payment amount verification failed."
          });
        }

        const gatewayCurrency =
          String(
            paymentEntity.currency ||
              ""
          )
            .trim()
            .toUpperCase();

        const localCurrency =
          String(
            payment.currency ||
              ""
          )
            .trim()
            .toUpperCase();

        if (
          !gatewayCurrency ||
          !localCurrency ||
          gatewayCurrency !==
            localCurrency
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Webhook payment currency verification failed."
          });
        }

        if (
          paymentEntity.order_id &&
          String(
            paymentEntity.order_id
          ) !==
            String(
              payment.razorpayOrderId
            )
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Webhook order does not match the stored payment."
          });
        }

        if (
          paymentEntity.id &&
          String(
            paymentEntity.id
          ) !==
            String(
              paymentId
            )
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Webhook payment ID mismatch."
          });
        }
      }

      /*
      ------------------------------------------------
      ATOMIC PAYMENT EVENT CLAIM
      ------------------------------------------------

      The event is added with $addToSet in the same
      database update as the payment status change.

      Therefore two simultaneous webhook deliveries
      with the same event ID cannot both successfully
      match the condition.
      ------------------------------------------------
      */

      let updatedPayment = null;

      if (
        eventId
      ) {
        updatedPayment =
          await Payment.findOneAndUpdate(
            {
              _id:
                payment._id,

              processedWebhookEvents: {
                $ne:
                  eventId
              }
            },
            {
              $set: {
                status:
                  "paid",

                paidAt:
                  payment.paidAt ||
                  new Date(),

                ...(paymentId
                  ? {
                      gatewayPaymentId:
                        paymentId,

                      transactionId:
                        paymentId
                    }
                  : {})
              },

              $addToSet: {
                processedWebhookEvents:
                  eventId
              }
            },
            {
              new: true
            }
          );
      } else {
        /*
        No event ID: state update remains idempotent
        at payment-state level.
        */

        updatedPayment =
          await Payment.findOneAndUpdate(
            {
              _id:
                payment._id,

              status: {
                $ne:
                  "refunded"
              }
            },
            {
              $set: {
                status:
                  "paid",

                paidAt:
                  payment.paidAt ||
                  new Date(),

                ...(paymentId
                  ? {
                      gatewayPaymentId:
                        paymentId,

                      transactionId:
                        paymentId
                    }
                  : {})
              }
            },
            {
              new: true
            }
          );
      }

      /*
      Duplicate event:
      another concurrent request already added the
      event ID and processed the payment.
      */

      if (
        eventId &&
        !updatedPayment
      ) {
        return res.status(200).json({
          success: true,
          message:
            "Webhook already processed."
        });
      }

      /*
      ------------------------------------------------
      ATOMIC BOOKING CONFIRMATION
      ------------------------------------------------
      */

      if (
        updatedPayment
      ) {
        await Booking.findOneAndUpdate(
          {
            _id:
              updatedPayment.bookingId,

            status:
              "accepted"
          },
          {
            $set: {
              status:
                "confirmed",

              confirmedAt:
                new Date()
            }
          }
        );
      }

    /*
    ------------------------------------------------
    PAYMENT.AUTHORIZED
    ------------------------------------------------

    Authorized != captured.

    Therefore this event NEVER changes payment
    status to paid.
    ------------------------------------------------
    */

    } else if (
      event ===
      "payment.authorized"
    ) {
      if (
        eventId
      ) {
        const recorded =
          await Payment.findOneAndUpdate(
            {
              _id:
                payment._id,

              processedWebhookEvents: {
                $ne:
                  eventId
              }
            },
            {
              $addToSet: {
                processedWebhookEvents:
                  eventId
              }
            },
            {
              new: true
            }
          );

        if (
          !recorded
        ) {
          return res.status(200).json({
            success: true,
            message:
              "Webhook already processed."
          });
        }
      }

    /*
    ------------------------------------------------
    PAYMENT.FAILED
    ------------------------------------------------
    */

    } else if (
      event ===
      "payment.failed"
    ) {
      if (
        eventId
      ) {
        /*
        Payment failure and event recording happen
        atomically.

        A payment that has already become paid or
        refunded is never downgraded.
        */

        const failedPayment =
          await Payment.findOneAndUpdate(
            {
              _id:
                payment._id,

              processedWebhookEvents: {
                $ne:
                  eventId
              },

              status: {
                $nin: [
                  "paid",
                  "refunded"
                ]
              }
            },
            {
              $set: {
                status:
                  "failed",

                failedAt:
                  payment.failedAt ||
                  new Date(),

                ...(paymentId
                  ? {
                      gatewayPaymentId:
                        paymentId
                    }
                  : {})
              },

              $addToSet: {
                processedWebhookEvents:
                  eventId
              }
            },
            {
              new: true
            }
          );

        if (
          !failedPayment
        ) {
          const currentPayment =
            await Payment.findById(
              payment._id
            ).select(
              "+processedWebhookEvents"
            );

          if (
            currentPayment?.processedWebhookEvents?.includes(
              eventId
            )
          ) {
            return res.status(200).json({
              success: true,
              message:
                "Webhook already processed."
            });
          }

          /*
          If the payment is already paid/refunded,
          acknowledge the event without downgrading
          financial state.
          */

          if (
            [
              "paid",
              "refunded"
            ].includes(
              currentPayment?.status
            )
          ) {
            return res.status(200).json({
              success: true,
              message:
                "Late payment failure ignored because the payment is already settled."
            });
          }

          return res.status(409).json({
            success: false,
            message:
              "Payment webhook could not be processed safely. Razorpay may retry it."
          });
        }
      } else {
        /*
        Without an event ID, do not downgrade a
        settled payment.
        */

        if (
          ![
            "paid",
            "refunded"
          ].includes(
            payment.status
          )
        ) {
          await Payment.findOneAndUpdate(
            {
              _id:
                payment._id,

              status: {
                $nin: [
                  "paid",
                  "refunded"
                ]
              }
            },
            {
              $set: {
                status:
                  "failed",

                failedAt:
                  payment.failedAt ||
                  new Date(),

                ...(paymentId
                  ? {
                      gatewayPaymentId:
                        paymentId
                    }
                  : {})
              }
            }
          );
        }
      }

    /*
    ------------------------------------------------
    REFUND.PROCESSED
    ------------------------------------------------
    */

    } else if (
      event ===
      "refund.processed"
    ) {
      if (
        eventId
      ) {
        const refundedPayment =
          await Payment.findOneAndUpdate(
            {
              _id:
                payment._id,

              processedWebhookEvents: {
                $ne:
                  eventId
              }
            },
            {
              $set: {
                status:
                  "refunded",

                refundedAt:
                  payment.refundedAt ||
                  new Date(),

                ...(refundEntity?.id
                  ? {
                      refundId:
                        String(
                          refundEntity.id
                        )
                    }
                  : {}),

                ...(refundEntity?.amount !==
                undefined
                  ? {
                      refundAmount:
                        Number(
                          refundEntity.amount
                        ) || 0
                    }
                  : {})
              },

              $addToSet: {
                processedWebhookEvents:
                  eventId
              }
            },
            {
              new: true
            }
          );

        if (
          !refundedPayment
        ) {
          return res.status(200).json({
            success: true,
            message:
              "Webhook already processed."
          });
        }
      } else {
        await Payment.findOneAndUpdate(
          {
            _id:
              payment._id
          },
          {
            $set: {
              status:
                "refunded",

              refundedAt:
                payment.refundedAt ||
                new Date(),

              ...(refundEntity?.id
                ? {
                    refundId:
                      String(
                        refundEntity.id
                      )
                  }
                : {}),

              ...(refundEntity?.amount !==
              undefined
                ? {
                    refundAmount:
                      Number(
                        refundEntity.amount
                      ) || 0
                  }
                : {})
            }
          }
        );
      }

    /*
    ------------------------------------------------
    OTHER WEBHOOK EVENTS
    ------------------------------------------------
    */

    } else if (
      eventId
    ) {
      /*
      Unknown-but-valid event:
      record it atomically so duplicate deliveries
      do not repeatedly execute processing.
      */

      const recorded =
        await Payment.findOneAndUpdate(
          {
            _id:
              payment._id,

            processedWebhookEvents: {
              $ne:
                eventId
            }
          },
          {
            $addToSet: {
              processedWebhookEvents:
                eventId
            }
          },
          {
            new: true
          }
        );

      if (
        !recorded
      ) {
        return res.status(200).json({
          success: true,
          message:
            "Webhook already processed."
        });
      }
    }

    return res.status(200).json({
      success: true,
      message:
        "Razorpay webhook processed successfully."
    });
  } catch (error) {
    console.error(
      "RAZORPAY WEBHOOK ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to process Razorpay webhook."
    });
  }
  }
