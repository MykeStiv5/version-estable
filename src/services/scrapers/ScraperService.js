'use strict';

require('dotenv').config();

const fs=require('fs');
const path=require('path');

const {bus,EVENTS}=require('../../shared/EventBus');
const {createSourceLogger}=require('../Logger');

const log=
createSourceLogger(
'ScraperService'
);

const website=
require('./WebsiteScraper');

const instagram=
require('./InstagramScraper');

const SCRAPE_INTERVAL_MS=
parseInt(
process.env.SCRAPE_INTERVAL_MS,
10
)||15*60*1000;

class ScraperService{

constructor(){

this._running=false;
this._scraping=false;
this._timer=null;

this._seenIds=
new Set();

this._seenPath=null;

this._context=null;
this._playwright=null;

this._instagramPage=null;

}

async start(){

if(this._running)return;

this._running=true;

await this._loadSeen();

log.info(
'ScraperService iniciado'
);

await this._runCycle();

this._timer=
setInterval(

()=>this._runCycle(),
SCRAPE_INTERVAL_MS

);

}

async stop(){

this._running=false;

if(this._timer){

clearInterval(
this._timer
);

this._timer=null;

}

await this._closeBrowser();

log.warn(
'Scraper detenido'
);

}

async forceCycle(){

return this._runCycle();

}

async _runCycle(){

if(this._scraping)return;

this._scraping=true;

try{

log.info(
'Scraping cycle...'
);

const results=
await Promise.allSettled([

website.scrape(
10,
this._seenIds
),

this._scrapeInstagramWrapper()

]);

let all=[];

for(const r of results){

if(
r.status!=='fulfilled'
){

log.error(
r.reason?.message
);

continue;

}

if(
Array.isArray(
r.value
)
){

all.push(
...r.value
);

}

}

const filtered=

all.filter(

p=>

p.id &&

!this._seenIds.has(
p.id
)

);

const latestInstagram=

filtered.find(

p=>

p.source===
'instagram'

);

const latestWebsite=

filtered.find(

p=>

p.source===
'website'

);

const fresh=[];

if(
latestInstagram
){

fresh.push(
latestInstagram
);

}

if(
latestWebsite
){

fresh.push(
latestWebsite
);

}

if(
fresh.length
){

fresh.forEach(

p=>
this._seenIds.add(
p.id
)

);

await this._saveSeen();

log.info(

`Posts nuevos: ${fresh.length}`

);

bus.emit(

EVENTS.SCRAPER_NEW_POSTS,
fresh

);

}
else{

log.info(
'Sin publicaciones nuevas'
);

}

}
catch(err){

log.error(
err.message
);

}

this._scraping=false;

}

async _scrapeInstagramWrapper(){

try{

const page=
await this._getInstagramPage();

const posts=
await instagram.scrape(

page,
10,
this._seenIds

);

log.info(

`Instagram: ${posts.length}`

);

return posts||[];

}
catch(err){

log.error(

`Instagram error: ${err.message}`

);

return[];

}

}

async _getInstagramPage(){

if(

this._instagramPage &&
!this._instagramPage.isClosed()

){

return this._instagramPage;

}

const context=
await this._getBrowser();

this._instagramPage=
await context.newPage();

await this._instagramPage.goto(

'https://www.instagram.com/titularizadora.colombiana/',

{

waitUntil:'networkidle',
timeout:60000

}

);

return this._instagramPage;

}

async _getBrowser(){

if(
this._context
){

return this._context;

}

this._playwright=
require(
'playwright'
);

const sessionPath=
path.join(

process.cwd(),
'.instagram-session'

);

fs.mkdirSync(

sessionPath,
{
recursive:true
}

);

log.info(
'Abriendo Edge...'
);

this._context=

await this._playwright.chromium.launchPersistentContext(

sessionPath,

{

headless:false,

channel:'msedge',

args:[

'--start-maximized'

]

}

);

return this._context;

}

async _closeBrowser(){

try{

if(
this._context
){

await this._context.close();

}

}catch(_){}

this._context=null;

this._instagramPage=null;

}

_getSeenPath(){

if(
this._seenPath
){

return this._seenPath;

}

this._seenPath=

path.join(

process.cwd(),
'storage',
'seen.json'

);

return this._seenPath;

}

async _loadSeen(){

try{

const p=
this._getSeenPath();

if(
fs.existsSync(p)
){

this._seenIds=
new Set(

JSON.parse(

fs.readFileSync(
p,
'utf8'
)

)

);

}

}
catch(_){

this._seenIds=
new Set();

}

}

async _saveSeen(){

fs.writeFileSync(

this._getSeenPath(),

JSON.stringify(

[...this._seenIds]
.slice(-1000)

)

);

}

}

module.exports=
new ScraperService();