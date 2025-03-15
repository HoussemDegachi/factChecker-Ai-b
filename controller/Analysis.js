import ContentAnalysis from "../models/ContentAnalysis.js"

export const get = async (req, res) => {
    const { id } = req.params
    const { data } = req.body

    const analysis = await ContentAnalysis.findOne({ originalId: id })

    // if analysis already exist for this video
    if (analysis) return res.status(200).json(analysis)

    // else create new analysis
    res.status(500).json({message: "creating analysis"})

}

export default {
    get
}