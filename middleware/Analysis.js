import ExpressError from "../utils/ExpressError.js"
import { extractYouTubeVideoId, getYtMetaData } from "../utils/funcs.js"

export const isUrlIdValid = async (req, res, next) => {
    const { url } = req.params
    const id = extractYouTubeVideoId(url)

    if (!url) return next(ExpressError("Url is invalid", 400))

    let data;
    try {
        data = await getYtMetaData(id)
    } catch (e) {
        return next(new ExpressError("Video is unavailable", 400))
    }
    req.body.data = data
    req.body.id = id
    return next()
}

export default { isUrlIdValid }