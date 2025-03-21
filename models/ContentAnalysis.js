import { Schema, Types, model } from "mongoose";

const contentAnalysisSchema = Schema({
    originalId: { type: String, required: true },
    conclusion: {
        type: String,
        required: true
    },

    percentages: {
        overall: {
            type: Number,
            required: true,
            min: 0,
            max: 100
        },
        falseInformation: {
            type: Number,
            required: true,
            min: 0,
            max: 100
        },
        verifiedInformation: {
            type: Number,
            required: true,
            min: 0,
            max: 100
        },
        misleadingInformation: {
            type: Number,
            required: true,
            min: 0,
            max: 100
        }
    },

    topics: {
        categories: [
            {
                title: {
                    type: String,
                    required: true
                },
                count: {
                    type: Number,
                    required: true
                }
            }
        ],
        count: {
            type: Number,
            required: true
        }
    },

    generalTopic: {
        type: String,
        required: true
    },

    timestamps: [
        {
            timestampInS: {
                type: Number,
            },
            timestampInStr: {
                type: String,
                required: true
            },
            label: {
                type: String,
                enum: ["Correct", "False", "Misleading"],
                required: true
            },
            claim: {
                type: String,
            },
            explanation: {
                type: String,
            },
            source: {
                type: String,
            },
            validation: {
                isValid: Boolean,
                confidence: {
                    type: Number,
                    min: 0,
                    max: 100
                },
                explanation: String,
                references: [
                    {
                        title: String,
                        url: String,
                        author:  String,
                        publisher: String,
                        credibilityScore: {
                            type: Number,
                            min: 1,
                            max: 10
                        }
                    }
                ]
            }
        }
    ],
})

export default model("ContentAnalysis", contentAnalysisSchema)
