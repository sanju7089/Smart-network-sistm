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
5. Required Razorpay event ID.
6. Atomic event idempotency.
7. Payment state transition.
8. Booking state transition.
9. Payment -> booking reconciliation on retries.
10. Paid/refunded states are never downgraded.
11. Concurrent duplicate events are protected.
12. Captured payment validation.
13. Refund validation.
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

    /*
    ------------------------------------------------
    EVENT ID IS REQUIRED
    ------------------------------------------------

    Event-level duplicate protection depends on
    Razorpay's unique event ID.

    A webhook without an event ID cannot safely
    claim exactly-once processing, therefore it is
    rejected instead of being processed ambiguously.
    ------------------------------------------------
    */

    if (!eventId) {
      return res.status(400).json({
        success: false,
        message:
          "Razorpay webhook event ID is required."
      });
    }

    if (
      eventId.length > 200
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid Razorpay webhook event ID."
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
    PAYMENT.CAPTURED
    ------------------------------------------------
    */

    if (
      event ===
      "payment.captured"
    ) {
      if (
        !paymentEntity ||
        !paymentId ||
        !orderId
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Captured payment webhook is missing required payment data."
        });
      }

      /*
      Validate amount.
      */

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

      /*
      Validate currency.
      */

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

      /*
      Validate order mapping.
      */

      if (
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

      /*
      Validate payment mapping.
      */

      if (
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

      /*
      ------------------------------------------------
      CHECK PAYMENT ID REUSE
      ------------------------------------------------
      */

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
          "WEBHOOK PAYMENT ID REUSE DETECTED:",
          {
            eventId,
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

      /*
      ------------------------------------------------
      ATOMIC PAYMENT EVENT CLAIM
      ------------------------------------------------

      The payment state and event ID are written in
      one atomic MongoDB operation.

      Two simultaneous deliveries of the same event
      cannot both claim the event.
      ------------------------------------------------
      */

      const now =
        new Date();

      const updatedPayment =
        await Payment.findOneAndUpdate(
          {
            _id:
              payment._id,

            processedWebhookEvents: {
              $ne:
                eventId
            },

            /*
            Never let a captured event overwrite a
            refunded payment.
            */

            status: {
              $nin: [
                "refunded"
              ]
            }
          },
          {
            $set: {
              status:
                "paid",

              paidAt:
                payment.paidAt ||
                now,

              gatewayPaymentId:
                paymentId,

              transactionId:
                paymentId
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

      /*
      ------------------------------------------------
      DUPLICATE EVENT / RETRY RECONCILIATION
      ------------------------------------------------

      If the event was already processed, we MUST NOT
      simply return success.

      The previous attempt may have marked payment
      paid and failed while confirming the booking.

      Therefore the current payment state is loaded
      and booking confirmation is retried.
      ------------------------------------------------
      */

      let currentPayment =
        updatedPayment;

      if (
        !currentPayment
      ) {
        currentPayment =
          await Payment.findById(
            payment._id
          );

        if (
          !currentPayment
        ) {
          return res.status(500).json({
            success: false,
            message:
              "Payment record disappeared while processing the webhook."
          });
        }

        if (
          currentPayment.status ===
            "refunded"
        ) {
          return res.status(200).json({
            success: true,
            message:
              "Captured event ignored because the payment is already refunded."
          });
        }

        if (
          currentPayment.status !==
          "paid"
        ) {
          return res.status(500).json({
            success: false,
            message:
              "Payment webhook state could not be reconciled safely."
          });
        }

        if (
          String(
            currentPayment.gatewayPaymentId
          ) !==
          paymentId
        ) {
          return res.status(409).json({
            success: false,
            message:
              "Stored payment ID does not match the captured Razorpay payment."
          });
        }
      }

      /*
      ------------------------------------------------
      BOOKING CONFIRMATION
      ------------------------------------------------

      This operation is intentionally outside the
      payment update so that a failure causes HTTP 500
      and Razorpay can retry the webhook.

      On retry, the duplicate-event path above reloads
      the paid payment and attempts confirmation again.
      ------------------------------------------------
      */

      const bookingUpdate =
        await Booking.findOneAndUpdate(
          {
            _id:
              currentPayment.bookingId,

            status:
              "accepted"
          },
          {
            $set: {
              status:
                "confirmed",

              confirmedAt:
                now
            }
          },
          {
            new: true
          }
        );

      /*
      If booking was already confirmed, that is also
      a successful reconciliation state.

      If it is neither confirmed nor accepted, do not
      silently hide an inconsistent state.
      */

      if (
        !bookingUpdate
      ) {
        const currentBooking =
          await Booking.findById(
            currentPayment.bookingId
          );

        if (
          !currentBooking
        ) {
          throw new Error(
            "Booking associated with captured payment was not found."
          );
        }

        if (
          currentBooking.status !==
          "confirmed"
        ) {
          throw new Error(
            `Captured payment could not confirm booking. Current booking status: ${currentBooking.status}`
          );
        }
      }

    /*
    ------------------------------------------------
    PAYMENT.AUTHORIZED
    ------------------------------------------------

    Authorized is NOT captured.

    Therefore it is only recorded and never changes
    payment status to paid.
    ------------------------------------------------
    */

    } else if (
      event ===
      "payment.authorized"
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

    /*
    ------------------------------------------------
    PAYMENT.FAILED
    ------------------------------------------------
    */

    } else if (
      event ===
      "payment.failed"
    ) {
      /*
      A failed event must never downgrade a payment
      that is already paid or refunded.
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

        throw new Error(
          "Payment failure webhook could not be processed safely."
        );
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
        !refundEntity
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Refund webhook data is missing."
        });
      }

      /*
      Refund must reference the same payment.
      */

      if (
        refundPaymentId &&
        String(
          refundPaymentId
        ) !==
        String(
          payment.gatewayPaymentId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Refund payment does not match the stored payment."
        });
      }

      /*
      Validate refund currency when supplied.
      */

      const refundCurrency =
        String(
          refundEntity.currency ||
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
        refundCurrency &&
        refundCurrency !==
          localCurrency
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Refund currency does not match the payment currency."
        });
      }

      /*
      Validate refund amount when supplied.
      */

      let refundAmount = null;

      if (
        refundEntity.amount !==
        undefined
      ) {
        refundAmount =
          Number(
            refundEntity.amount
          );

        if (
          !Number.isSafeInteger(
            refundAmount
          ) ||
          refundAmount <= 0 ||
          refundAmount >
            Number(
              payment.amount
            )
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid refund amount."
          });
        }
      }

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

              ...(refundAmount !==
              null
                ? {
                    refundAmount
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

    /*
    ------------------------------------------------
    OTHER WEBHOOK EVENTS
    ------------------------------------------------
    */

    } else {
      /*
      Unknown-but-valid event:
      record it atomically so duplicate deliveries
      are safely ignored.
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

    /*
    Returning 500 is intentional for processing
    failures. Razorpay can retry the webhook.

    This is especially important when payment was
    already marked paid but booking confirmation
    failed. The next delivery enters the reconciliation
    path instead of incorrectly treating the job as done.
    */

    return res.status(500).json({
      success: false,
      message:
        "Unable to process Razorpay webhook."
    });
  }
}
