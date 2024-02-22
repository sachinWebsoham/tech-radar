const axios = require("axios");
const cheerio = require("cheerio");
const { parse: parseUrl } = require("url");
const result = require("./tldList");
const baseUrl = "https://www.techradar.com";
const domain = new URL(baseUrl).hostname.split(".").slice(-2).join(".");
const TLDs = require("./tldList");
const ccLTD = require("./cctldList");
// console.log(domain);

// const internalLinks = [];
// const externalLinks = [];
// const brokenLinks = [];
let internalLinks = [];
let externalLinks = [];
let brokenLinks = [];
let onetime = true;
const convertToStandardURL = (url) => {
  // Check if the URL starts with "http://" or "https://"
  if (url.startsWith("http://www.")) {
    // If it starts with "http://www.", replace it with "https://www."
    url = url.replace("http://www.", "https://www.");
  } else if (url.startsWith("http://")) {
    // If it starts with "http://", replace it with "https://www."
    url = url.replace("http://", "https://www.");
  } else if (url.startsWith("www.")) {
    // If it starts with "www.", prepend "https://"
    url = "https://" + url;
  } else if (!url.startsWith("https://")) {
    // If it doesn't start with "https://", prepend "https://www."
    url = "https://www." + url;
  }
  return url;
};

const isValidDomain = (domain) => {
  let validDomain;
  try {
    const domainPart = domain.split(".").filter((part) => part !== "");
    const partLength = domainPart.length;
    switch (true) {
      case partLength == 2 &&
        (TLDs.includes(domainPart[partLength - 1]) ||
          ccLTD.includes(domainPart[partLength - 1])):
        validDomain = domainPart.join(".");
        break;
      case partLength == 3 &&
        ccLTD.includes(domainPart[partLength - 1]) &&
        TLDs.includes(domainPart[partLength - 2]):
        validDomain = domainPart.join(".");
        break;
      case partLength == 3 && TLDs.includes(domainPart[partLength - 1]):
        validDomain = domainPart.slice(1).join(".");
        break;
      case partLength == 3 && ccLTD.includes(domainPart[partLength - 1]):
        validDomain = domainPart.slice(1).join(".");
        break;
      case partLength > 3 &&
        ccLTD.includes(domainPart[partLength - 1]) &&
        TLDs.includes(domainPart[partLength - 2]):
        const startIndex = Math.max(0, partLength - 3);
        validDomain = domainPart.slice(startIndex).join(".");
        break;
      case partLength > 3 && ccLTD.includes(domainPart[partLength - 1]):
        const startIndex1 = Math.max(0, partLength - 2);
        validDomain = domainPart.slice(startIndex1).join(".");
        break;
      case partLength > 3 && TLDs.includes(domainPart[partLength - 1]):
        const startIndex2 = Math.max(0, partLength - 2);
        validDomain = domainPart.slice(startIndex2).join(".");
        break;
      default:
        validDomain = "Invalid";
    }
    return validDomain;
  } catch (error) {
    console.log("Error-validDomain:", error.message);
  }
};
const checkLinkStatus = async (url) => {
  try {
    const response = await axios.head(url);
    return response.status;
  } catch (error) {
    return error.response ? error.response.data : 0;
  }
};
const checkAvailability = async (url) => {};

async function crawlWebsite(currentUrl, baseUrl, pages) {
  console.log(pages, "pages<,,,,,,,,,,,,,,,,,,,,,,,,,,>");
  let tempPages = [];
  try {
    const response = await axios.get(currentUrl);
    const $ = cheerio.load(response.data);

    $("a").each(async (index, element) => {
      const href = $(element).attr("href");

      if (href) {
        const standardHref = convertToStandardURL(href);
        const parsedUrl = parseUrl(href);
        if (href.startsWith("/")) {
          try {
            const pageUrl = convertToStandardURL(`${baseUrl}${href}`);
            if (!pages.includes(standardHref)) {
              pages.push(pageUrl);
              tempPages.push(pageUrl);
            }
          } catch (error) {
            console.log("Error-startswith:", error.message);
          }
        } else if (href.includes(domain)) {
          if (!pages.includes(standardHref)) {
            tempPages.push(standardHref);
            pages.push(standardHref);
          }
        } else if (parsedUrl?.hostname) {
          const validUrl = isValidDomain(parsedUrl?.hostname);
          if (validUrl !== "Invalid") {
            const validStandardUrl = convertToStandardURL(validUrl);

            if (!externalLinks.includes(validStandardUrl)) {
              externalLinks.push(validStandardUrl);
              const data = await checkLinkStatus(validStandardUrl);
              if (data !== 200) {
                brokenLinks.push(validStandardUrl);
              }
            }
          }
        }
        // Check if the link is broken
      }
    });
    if (tempPages?.length > 0) {
      for (const page of tempPages) {
        if (!internalLinks.includes(page)) {
          internalLinks.push(page);
        }
      }
    }
    internalLinks = internalLinks.filter((element) => element !== currentUrl);
    console.log(internalLinks, "internal");
    console.log(internalLinks.length, "length");
    if (!pages.includes(currentUrl)) {
      console.log(internalLinks.length, "length");
      for (const link of internalLinks) {
        console.log(link, "<<<<<<<<<<<<<<<<<<");
        // console.log(pages, "pages");
        onetime = false;
        pages = await crawlWebsite(link, baseUrl, pages);
        // console.log(pagee, "pagee-------------------------->");

        // return pages;
      }
    } else {
      console.log("elselselselleselle");
      return pages;
      process.exit(1);
    }
    return pages;
  } catch (error) {
    console.error("Error:", error.message);
  }
}

// checkLinkStatus("https://www.dosndf.com").then((r) => console.log(r));

// // Replace 'https://example.com' with the desired website URL to crawl
crawlWebsite(baseUrl, baseUrl, []).then((result) => {
  console.log(result, ">>>>>>>>>>>>>>");
  // console.log(externalLinks, "externallink");
});
// isValidDomain("");

// let array = [1, 2, 3, 4, 5, 9, 10, 6, 7, 8];
// let ab = [9, 10, 56];
// for (const a of ab) {
//   if (!array.includes(a)) {
//     array.push(a);
//   } else {
//     console.log(!array.includes(a), ".", a);
//     array = array.filter((element) => element !== a);
//   }
// }
// console.log(array);
