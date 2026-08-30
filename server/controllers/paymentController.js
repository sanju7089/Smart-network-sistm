/*
========================================
RAZORPAY WEBHOOK
========================================
*/

export async function razorpayWebhook(
  req,
  res
) {
  try {
    const webhookSecret =
      process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error(
        "RAZORPAY_WEBHOOK_SECRET is not configured."
      );

      return res.status(503).json({
        success: false,
        message:
          "Webhook is not configured."
      });
    }

    const signature =
      req.headers["x-razorpay-signature"];

    if (
      !signature ||
      !Buffer.isBuffer(req.body)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid webhook request."
      });
    }

    /*
      Verify the EXACT raw request body.
    */

    const generatedSignature =
      crypto
        .createHmac(
          "sha256",
          webhookSecret
        )
        .update(req.body)
        .digest("hex");

    const expected =
      Buffer.from(
        generatedSignature,
        "utf8"
      );

    const received =
      Buffer.from(
        String(signature),
        "utf8"
      );

    const signatureValid =
      expected.length ===
        received.length &&
      crypto.timingSafeEqual(
        expected,
        received
      );

    if (!signatureValid) {
      console.error(
        "Invalid Razorpay webhook signature."
      );

      return res.status(400).json({
        success: false,
        message:
          "Invalid webhook signature."
      });
    }

    let event;

    try {
      event = JSON.parse(
        req.body.toString("utf8")
      );
    } catch {
      return res.status(400).json({
        success: false,
        message:
          "Invalid webhook JSON."
      });
    }

    const eventName =
      event?.event;

    const webhookEventId =
      event?.payload?.payment?.entity?.id
        ? `${eventName}:${event.payload.payment.entity.id}`
        : event?.payload?.order?.entity?.id
          ? `${eventName}:${event.payload.order.entity.id}`
          : null;

    const paymentEntity =
      event?.payload?.payment?.entity;

    const orderEntity =
      event?.payload?.order?.entity;

    const razorpayPaymentId =
      paymentEntity?.id || null;

    const razorpayOrderId =
      paymentEntity?.order_id ||
      orderEntity?.id ||
      null;

    if (!razorpayOrderId) {
      /*
        Valid webhook, but not relevant
        to a local payment order.
      */

      return res.status(200).json({
        success: true,
        message: "Webhook received."
      });
    }

    const payment =
      await Payment.findOne({
        razorpayOrderId
      }).select(
        "+processedWebhookEvents"
      );

    if (!payment) {
      /*
        Return 200 so Razorpay does not
        endlessly retry an unknown order.
      */

      return res.status(200).json({
        success: true,
        message:
          "Webhook received for unknown order."
      });
    }

    /*
      Idempotency protection.
      Razorpay can send retries.
    */

    if (
      webhookEventId &&
      payment.processedWebhookEvents?.includes(
        webhookEventId
      )
    ) {
      return res.status(200).json({
        success: true,
        message:
          "Webhook already processed."
      });
    }

    /*
      Protect against reuse of the same
      Razorpay payment ID.
    */

    if (razorpayPaymentId) {
      const duplicatePayment =
        await Payment.findOne({
          gatewayPaymentId:
            razorpayPaymentId,

          _id: {
            $ne: payment._id
          }
        });

      if (duplicatePayment) {
        console.error(
          "Duplicate Razorpay payment ID detected."
        );

        return res.status(409).json({
          success: false,
          message:
            "Duplicate gateway payment."
        });
      }
    }

    const now = new Date();

    /*
      PAYMENT SUCCESS
    */

    if (
      eventName === "payment.captured" ||
      eventName === "payment.authorized"
    ) {
      if (
        payment.status !== "paid"
      ) {
        payment.status = "paid";

        payment.gatewayPaymentId =
          razorpayPaymentId ||
          payment.gatewayPaymentId;

        payment.paidAt =
          payment.paidAt || now;

        payment.failedAt = null;

        const booking =
          await Booking.findById(
            payment.bookingId
          );

        /*
          Do not revive cancelled/completed
          bookings automatically.
        */

        if (
          booking &&
          ![
            "cancelled",
            "completed"
          ].includes(booking.status)
        ) {
          if (
            booking.status === "pending" ||
            booking.status === "accepted"
          ) {
            booking.status =
              "confirmed";

            booking.confirmedAt =
              booking.confirmedAt ||
              now;

            await booking.save();
          }
        }
      }
    }

    /*
      PAYMENT FAILED
    */

    if (
      eventName === "payment.failed"
    ) {
      if (
        payment.status !== "paid"
      ) {
        payment.status = "failed";

        payment.gatewayPaymentId =
          razorpayPaymentId ||
          payment.gatewayPaymentId;

        payment.failedAt = now;
      }
    }

    /*
      PAYMENT REFUNDED
    */

    if (
      eventName === "refund.created" ||
      eventName === "refund.processed"
    ) {
      const refundEntity =
        event?.payload?.refund?.entity;

      if (refundEntity) {
        payment.status =
          "refunded";

        payment.refundId =
          refundEntity.id ||
          payment.refundId;

        payment.refundAmount =
          Number(refundEntity.amount || 0) / 100;

        payment.refundedAt =
          now;
      }
    }

    if (webhookEventId) {
      payment.processedWebhookEvents =
        [
          ...new Set([
            ...(
              payment.processedWebhookEvents ||
              []
            ),
            webhookEventId
          ])
        ].slice(-100);
    }

    await payment.save();

    return res.status(200).json({
      success: true,
      message:
        "Webhook processed successfully."
    });

  } catch (error) {
    console.error(
      "RAZORPAY WEBHOOK ERROR:",
      error
    );

    /*
      Return 500 so Razorpay can retry
      temporary server failures.
    */

    return res.status(500).json({
      success: false,
      message:
        "Unable to process webhook."
    });
  }
}
