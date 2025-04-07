import { parseArgs } from "node:util";

import { twoot, type Status, type StatusOrText } from "twoot";
import { close as flushSentry } from "@sentry/node";
import Database from "better-sqlite3";
import { load } from "cheerio";
import z from "zod";

import {
  BSKY_PASSWORD,
  BSKY_USERNAME,
  MASTODON_SERVER,
  MASTODON_TOKEN,
} from "./env.ts";

const getPage = (id: number, slug: string) =>
  `https://web.archive.org/web/2013/http://sandbox.yoyogames.com/games/${id}-${slug}`;

async function scrape() {
  const db = new Database("yoyogames-sandbox.db", { readonly: true });

  const gameTableSchema = z.object({
    id: z.number(),
    slug: z.string(),
    title: z.string(),
    developer: z.string(),
    downloads: z.number(),
    date: z.string(),
    description: z.string(),
    rating: z.number(),
    nratings: z.number(),
    dl_url: z.string().nullable().optional(),
  });

  const randomRow = db.prepare(
    `SELECT * FROM game WHERE id = (SELECT id FROM game ORDER BY RANDOM() LIMIT 1)`,
  );

  const game = gameTableSchema.parse(randomRow.get());

  console.log(JSON.stringify(game, undefined, 2));

  const url = getPage(game.id, game.slug);

  console.log(url);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Fetch error for "${url}": (${res.status}): "${res.statusText}"`,
    );
  }
  const body = await res.text();

  console.log("loaded page ok, scraping images...");

  const $ = load(body);
  const imageUrls = $(
    "#gameimages-carousel .carousel-list a[rel='lightbox[gameimage]']",
  )
    .toArray()
    .map((e) => {
      const $$ = $(e);
      return {
        full: new URL($$.attr("href")!, url).toString(),
        thumb: new URL($$.find("img").attr("src")!, url).toString(),
      };
    })
    .slice(0, 4);

  console.log(
    `image urls:\n${imageUrls.map((a, i) => `${i}) ${a.full}\n   ${a.thumb}\n`).join("\n")}`,
  );

  const images = [];

  for (const img of imageUrls) {
    let imgRes = await fetch(img.full);

    if (!imgRes.ok) {
      const origErr = `Fetch error for "${img.full}": (${imgRes.status}): "${imgRes.statusText}"`;
      imgRes = await fetch(img.thumb);
      if (!imgRes.ok) {
        console.warn(
          `Fetch errors:\n${origErr}\nFetch error for "${img.thumb}": (${imgRes.status}): "${imgRes.statusText}"`,
        );
        continue;
      }
    }

    let buff: Buffer = Buffer.from(await imgRes.arrayBuffer());

    if (new URL(imgRes.url).pathname.endsWith("bmp")) {
      // https://github.com/lovell/sharp/issues/806#issuecomment-1220062412
      const { decode } = await import("@vingle/bmp-js");
      const { default: sharp } = await import("sharp");
      const bmp = decode(buff, true);
      const image = sharp(bmp.data, {
        raw: { width: bmp.width, height: bmp.height, channels: 4 },
      });
      buff = await image.toFormat("png").toBuffer();
    }

    images.push(buff);
  }

  console.log(`fetched ${images.length} images.`);

  return { data: { ...game, page: res.url }, images };
}

type GameData = Awaited<ReturnType<typeof scrape>>;

// https://docs.joinmastodon.org/user/posting/#text
const MASTODON_CHARACTER_LIMIT = 500;
const BSKY_CHARACTER_LIMIT = 300;

async function doTwoot({ data, images }: GameData): Promise<void> {
  const topline = `${data.title} (${data.developer}, ${data.date})\n\n`;

  let bskyStatus = topline;
  let mastoStatus = topline;

  const rawDescription = data.description.trim();
  if (rawDescription.length > 0) {
    const { default: Turndown } = await import("turndown");
    const td = new Turndown({
      linkStyle: "referenced",
      linkReferenceStyle: "shortcut",
    });
    const description = td.turndown(rawDescription);

    const bskyRemaining = BSKY_CHARACTER_LIMIT - topline.length;
    let bskyDesc = description.slice(0, bskyRemaining - 2);
    if (bskyDesc.length !== description.length) {
      bskyDesc += "…";
    }
    bskyStatus += bskyDesc;

    const mastoRemaining = MASTODON_CHARACTER_LIMIT - topline.length;
    let mastoDesc = description.slice(0, mastoRemaining - 2);
    if (mastoDesc.length !== description.length) {
      mastoDesc += "…";
    }
    mastoStatus += mastoDesc;
  }

  const links = [`Game page: ${data.page}`];
  if (data.dl_url) links.push(`Download: ${data.dl_url}`);
  const linkText = links.join("\n");

  const params: Pick<Status, "media" | "visibility"> = {
    media: images.map((i) => ({ buffer: i })),
    visibility: "unlisted",
  };

  const bskySingle = `${bskyStatus}\n\n${linkText}`;
  const skeets: StatusOrText[] =
    bskySingle.length < BSKY_CHARACTER_LIMIT
      ? [{ status: bskySingle, ...params }]
      : [
          { status: bskyStatus, ...params },
          { status: linkText, visibility: "unlisted" },
        ];

  const mastoSingle = `${mastoStatus}\n\n${linkText}`;
  const toots: StatusOrText[] =
    mastoSingle.length < MASTODON_CHARACTER_LIMIT
      ? [{ status: bskySingle, ...params }]
      : [
          { status: bskyStatus, ...params },
          { status: linkText, visibility: "unlisted" },
        ];

  const results = await Promise.all([
    twoot(skeets, {
      type: "bsky",
      username: BSKY_USERNAME,
      password: BSKY_PASSWORD,
    }),
    twoot(toots, {
      type: "mastodon",
      server: MASTODON_SERVER,
      token: MASTODON_TOKEN,
    }),
  ]);

  console.log(results.map((r) => r.message).join("\n\n"));
}

const {
  values: { local },
} = parseArgs({ options: { local: { type: "boolean" } } });

if (local) {
  console.log("running locally!");
}

const data = await scrape();

if (local) {
  console.log("data:\n");
  console.log(data);
} else {
  await doTwoot(data);
}

await flushSentry(2000);
