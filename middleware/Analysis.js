import { getYtMetaData } from "../utils/funcs.js"

export const isUrlIdValid = async (req, res, next) => {
    const { id } = req.params

    let data;
    try {
        data = await getYtMetaData(id)
    } catch (e) {
        return next(e)
    }
    req.body.data = data
    return next()
}

export default { isUrlIdValid }