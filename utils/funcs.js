import ExpressError from "./ExpressError.js"
import axios from "axios"

export const getYtMetaData = async (ytId) => {
    const url = `https://www.youtube.com/oembed?format=json&url=https://www.youtube.com/watch?v=${ytId}`
    try {
        const res = await axios.get(url)
        return res.data
    } catch (e) {
        throw new ExpressError("This video is unavailable", e.status)
    }
}

export default {
    getYtMetaData
}