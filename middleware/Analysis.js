import ExpressError from "../utils/ExpressError.js"
import { doesYtIdExist, extractYouTubeVideoId, getYtMetaData } from "../utils/funcs.js"

export const isUrlIdValid = async (req, res, next) => {
    const url = decodeURIComponent(req.params[0])
    const id = extractYouTubeVideoId(url)

    if (!url) return next(new ExpressError("Url is invalid", 400))

    if (!doesYtIdExist(id)) return next(new ExpressError("This video is invalid", 400))
    
    req.body.id = id
    req.params[0] = url
    return next()
}

export default { isUrlIdValid }
