// Ai/transcriptService.js
import axios from 'axios';
import { getSubtitles } from 'youtube-captions-scraper';
import { getYtMetaData } from '../utils/funcs.js';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from "puppeteer-extra-plugin-stealth"

puppeteer.use(StealthPlugin())

export async function getYoutubeTranscript(videoId) {
    const browser = await puppeteer.launch({
        headless: "new",
        ignoreDefaultArgs: ["--enable-automation"]
    }); // Starting the headless browser (Chrome)

    const page = await browser.newPage();
    let result = null;
    const url = `https://www.youtube.com/watch?v=${videoId}` // reading the URL

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded' }); // opening the youtube URL

        await page.evaluate(() => {
            document.querySelector('button[aria-label*=cookies]')?.click() // closing the Cookie banner
        });

        await page.waitForSelector("ytd-video-description-transcript-section-renderer button", {
            timeout: 10_000
        }) // waiting max 10 seconds for the 'Show transcript' button to appear

        await page.evaluate(() => {
            document.querySelector('ytd-video-description-transcript-section-renderer button').click()
        }) // clicking on the 'Show transcript' button

        result = await parseTranscript(page); // parsing the transcript

        await page.close()
        await browser.close()

        console.log(result) // returning the transcript
        return {
            isRealTranscript: true,
            text: result,
        }
    } catch (error) {
        try {

            const metadata = await getYtMetaData(videoId);

            if (!metadata || !metadata.title) {
                throw new Error('Could not retrieve video metadata');
            }
            console.log(error)

            await page.close()
            await browser.close()
            return {
                text: null,
                isRealTranscript: false,
                metadata: {
                    title: metadata.title,
                    author: metadata.author,
                    category: metadata.category,
                    description: metadata.description
                }
            };
        } catch (e) {
            return {
                text: null,
                isRealTranscript: false,
                isMinimalData: true
            };
        }
    }
}



const parseTranscript = async (page) => {
    // waiting max 10 seconds for the transcript container to appear
    await page.waitForSelector('#segments-container', {
        timeout: 10_000
    });

    // parsing all the text nodes from the transcript container and join them with an empty line
    return page.evaluate(() => {
        const arr = []
        Array.from(document.querySelectorAll('#segments-container yt-formatted-string')).map(
            element => {arr.push(element.textContent?.trim())})
        Array.from(document.querySelectorAll('#segments-container .segment-timestamp')).map(
            (element, i) => {arr[i] += ` (${element.textContent?.trim()})`})
        return arr.join("\n")
    });
}