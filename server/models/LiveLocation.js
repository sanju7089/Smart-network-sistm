import mongoose from "mongoose";

const liveLocationSchema = new mongoose.Schema(
  {
    entityType: {
      type: String,
      enum: ["job", "worker"],
      required: true,
      index: true
    },

    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    latitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90
    },

    longitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180
    },

    point: {
      type: {
        type: String,
        enum: ["Point"],
        required: true,
        default: "Point"
      },

      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator(value) {
            return (
              Array.isArray(value) &&
              value.length === 2 &&
              Number.isFinite(value[0]) &&
              Number.isFinite(value[1]) &&
              value[0] >= -180 &&
              value[0] <= 180 &&
              value[1] >= -90 &&
              value[1] <= 90
            );
          },
          message: "Invalid GeoJSON coordinates."
        }
      }
    },

    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

liveLocationSchema.index({
  point: "2dsphere"
});

liveLocationSchema.index(
  {
    entityType: 1,
    entityId: 1
  },
  {
    unique: true
  }
);

liveLocationSchema.index({
  userId: 1,
  entityType: 1,
  updatedAt: -1
});

const LiveLocation =
  mongoose.models.LiveLocation ||
  mongoose.model(
    "LiveLocation",
    liveLocationSchema
  );

export default LiveLocation;
