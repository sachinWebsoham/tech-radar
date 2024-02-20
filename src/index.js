// const { getUrlFromPage } = require("./getUrlFromPage");
const baseUrl = `https://www.techradar.com/sitemap.xml`;
const domain = new URL(baseUrl).hostname.split(".").slice(-2).join(".");
const axios = require("axios");
const { supabase } = require("../config/config");
const cheerio = require("cheerio");
const TLDs = require("./tldList");
const ccLTD = require("./cctldList");
let urls = [];

const validDomain = (domain) => {
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
        validDomain = "Invalid domain";
    }
    return validDomain;
  } catch (error) {
    console.log("Error-validDomain:", error.message);
  }
};
const externalLinkExtractor = async (currentUrl, domain) => {
  let urlFailed = [];

  const response = await fetch(currentUrl);
  const htmlBody = await response.text();

  try {
    let $ = cheerio.load(htmlBody);
    const linkElements = $("a");
    if (linkElements && linkElements.length != 0) {
      for (const linkElement of linkElements) {
        const href = $(linkElement).attr("href");
        // console.log("6");

        if (
          href &&
          !href.includes(domain) &&
          (href.startsWith("https") || href.startsWith("http"))
        ) {
          // console.log("7");

          let domain = new URL(href).hostname;
          if (domain.startsWith("www.")) {
            domain = domain.replace(/^www\./, "");
          }
          const validUrl = await validDomain(domain);
          if (!urls.includes(validUrl)) {
            urls.push(validUrl);
            await supabase.from("domain_link").insert({ url: validUrl });
            try {
              const res = await fetch(href);
              if (res.status > 399) {
                urlFailed.push({ status: res.status, url: validUrl });
                await supabase
                  .from("domain_detail")
                  .insert({ url: validUrl, status_code: res.status });
              }
            } catch (error) {
              // console.log("Error-inside-extractor", error.message);
            }
          }
        }
      }
    }
    return urlFailed;
  } catch (error) {
    console.log("Error-externalLinkExtractor :", error.message);
  }
};

const crawlPages = async (baseUrl, domain) => {
  try {
    const locUrls = await locUrlExtractor(baseUrl, domain);
    console.log(`Total of Pages: ${locUrls?.length} `);
    // let i = 1;
    for (const locUrl of locUrls) {
      if (locUrl) {
        // console.log(i++);
        await externalLinkExtractor(locUrl, domain).then(async (result) => {
          if (result?.length > 0) {
            const results = await filteration(result);
            if (results?.length > 0) {
              const domain_available = results.filter(
                (item) => item.purchasable == true
              );
              for (const data of domain_available) {
                await supabase
                  .from("domains")
                  .insert({ domain_available: data });
              }
            }
          }
        });
      }
    }
  } catch (error) {
    console.log("Error-crawlpage:", error.message);
  }
  return urls;
};

const locUrlExtractor = async (currentUrl, domain) => {
  let links = [];
  try {
    const response = await fetch(currentUrl);
    const textContent = await response.text();
    let $ = cheerio.load(textContent);
    const locUrls = $("loc");
    for (const locUrl of locUrls) {
      let link = $(locUrl).text();
      if (link.includes(domain)) {
        if (link.includes(".xml")) {
          const locLinks = await locUrlExtractor(link, domain);
          for (const locLink of locLinks) {
            links.push(locLink);
          }
        } else {
          links.push(link);
        }
      }
    }
  } catch (error) {
    console.log("locUrlExtractor Error :", error.message);
  }

  return links;
};

const filteration = async (urls) => {
  return new Promise((resolve, reject) => {
    const urlList = urls.map((item) => item.url);
    let allUrls = [];
    const chunkSize = 30;
    const domainList = [];

    for (let i = 0; i < urlList.length; i += chunkSize) {
      const chunk = urlList.slice(i, i + chunkSize);
      domainList.push(chunk);
    }

    for (const chunk of domainList) {
      let data = JSON.stringify({
        domainNames: chunk,
      });
      let config = {
        method: "post",
        maxBodyLength: Infinity,
        url: "https://api.name.com/v4/domains:checkAvailability",
        headers: {
          "Content-Type": "application/json",
          Authorization:
            "Basic c2FjaGluc29uaTIwMDI6MzVmNGM0YjlkYTZlNmRmMTRjNTZlYzI5NDgyZTQ0NGRlMDMwM2ZkOQ==",
          Cookie:
            "__cf_bm=foa0U5B6HrjSrHinEcVzeb2uHWyptHfa_aUPLkgbUag-1708323599-1.0-AZwXBQlyr43Vm92m7YbKTAwRiUygbM+4Ae4LddweaMxXSXgOpOjgYQpLINK47fHgCfzMdDrNojVNnEJvhKowN6c=; REG_IDT=91dd855832bf96530072814b83a65d1a; TS01b5f4e3=0181d9135deb803979a20d4ee24f2eaad587e1d133666ac318c06f68d002e0e902fb4eb038df411a7f9b85fa69d215fab4b35876f5",
        },
        data: data,
      };
      axios
        .request(config)
        .then((response) => {
          resolve(response.data.results);
        })
        .catch((error) => {
          reject(error);
        });
    }
  });
};

crawlPages(baseUrl, domain)
  .then(async (result) => {
    console.log(result, "real");
  })
  .catch((e) => console.log("Error-crawling-result:", e.message));
