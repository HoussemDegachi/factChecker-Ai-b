import { Schema, Types, model } from "mongoose";

const contentAnalysisSchema = Schema({
    title: { type: String, requried: true },
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
        FalseInfromation: {
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
        missleadingInformation: {
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
            required: True
        }
    },

    timestamps: [
        {
            timestampInS: {
                type: Number,
                required: true
            },
            timestempInStr: {
                type: String,
                required: true
            },
            label: {
                type: String,
                enum: ["Correct", "False", "Missleading"],
                required: true
            },
            claim: {
                type: String,
                required: true
            },
            explanation: {
                type: String,
                required: True
            },
            source: {
                type: String,
                required: true
            }
        }
    ]

    // to add later
    // sources of information with their rating
    // educational recommendation
})

export default model("ContentAnalysis", contentAnalysisSchema)