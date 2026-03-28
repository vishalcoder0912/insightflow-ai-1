import mongoose from "mongoose";

const datasetSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      default: "current",
    },
    fileName: {
      type: String,
      required: true,
    },
    uploadedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    headers: {
      type: [String],
      required: true,
    },
    rows: {
      type: [[String]],
      required: true,
    },
    totalRows: {
      type: Number,
      required: true,
    },
    previewRows: {
      type: [[String]],
      required: true,
    },
    summary: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  { timestamps: true },
);

datasetSchema.index({ id: 1, uploadedAt: -1 });

export const Dataset = mongoose.models.Dataset || mongoose.model("Dataset", datasetSchema);
