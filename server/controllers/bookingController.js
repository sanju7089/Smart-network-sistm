const bookings = [];

export function getBookings(req, res) {
  const userId = req.user?.id;

  const data = userId
    ? bookings.filter(
        (booking) =>
          booking.customerId === userId ||
          booking.workerId === userId
      )
    : bookings;

  res.json({
    success: true,
    data
  });
}

export function getBookingById(req, res) {
  const booking = bookings.find(
    (item) => item.id === req.params.id
  );

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: "Booking not found."
    });
  }

  res.json({
    success: true,
    data: booking
  });
}

export function createBooking(req, res) {
  const { workerId, jobId, date, notes } = req.body;

  if (!workerId) {
    return res.status(400).json({
      success: false,
      message: "Worker ID is required."
    });
  }

  const booking = {
    id: Date.now().toString(),
    customerId: req.user?.id || null,
    workerId,
    jobId: jobId || null,
    date: date || null,
    notes: notes || "",
    status: "pending",
    createdAt: new Date().toISOString()
  };

  bookings.unshift(booking);

  res.status(201).json({
    success: true,
    message: "Booking created successfully.",
    data: booking
  });
}

export function updateBookingStatus(req, res) {
  const booking = bookings.find(
    (item) => item.id === req.params.id
  );

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: "Booking not found."
    });
  }

  const { status } = req.body;

  if (!status) {
    return res.status(400).json({
      success: false,
      message: "Booking status is required."
    });
  }

  booking.status = status;
  booking.updatedAt = new Date().toISOString();

  res.json({
    success: true,
    message: "Booking updated successfully.",
    data: booking
  });
}

export function cancelBooking(req, res) {
  const index = bookings.findIndex(
    (item) => item.id === req.params.id
  );

  if (index === -1) {
    return res.status(404).json({
      success: false,
      message: "Booking not found."
    });
  }

  const booking = bookings[index];
  booking.status = "cancelled";
  booking.updatedAt = new Date().toISOString();

  res.json({
    success: true,
    message: "Booking cancelled successfully.",
    data: booking
  });
    }
