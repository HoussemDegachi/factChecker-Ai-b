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
                        publicationDate: Date,
                        credibilityScore: {
                            type: Number,
                            min: 1,
                            max: 10
                        }
                    }
                ]
            }
        }
    ]

    // to add later
    // sources of information with their rating
    // educational recommendation
})

export default model("ContentAnalysis", contentAnalysisSchema)