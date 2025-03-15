import { Schema, Types, model } from "mongoose";

const contentAnalysisSchema = Schema({
    title: { type: String, required: true },
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

    timestamps: [
        {
            timestampInS: {
                type: Number,
                required: true
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
                required: true
            },
            explanation: {
                type: String,
                required: true
            },
            source: {
                type: String,
                required: true
            },
            validation: {
                isValid: {
                    type: Boolean,
                    required: true
                },
                confidence: {
                    type: Number,
                    required: true,
                    min: 0,
                    max: 100
                },
                explanation: {
                    type: String,
                    required: true
                },
                references: [
                    {
                        title: {
                            type: String,
                            required: true
                        },
                        url: {
                            type: String,
                            required: false
                        },
                        author: {
                            type: String,
                            required: false
                        },
                        publisher: {
                            type: String,
                            required: false
                        },
                        publicationDate: {
                            type: String,
                            required: false
                        },
                        credibilityScore: {
                            type: Number,
                            required: true,
                            min: 1,
                            max: 10
                        }
                    }
                ]
            }
        }
    ]

    // to add later
    // educational recommendation
})

export default model("ContentAnalysis", contentAnalysisSchema)