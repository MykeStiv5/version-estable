'use strict';

const axios=require('axios');
const cheerio=require('cheerio');
const {hash}=require('./utils/hash');

const WEBSITE_URL=
'https://www.titularizadora.com/es';

class WebsiteScraper{

async scrape(
max=5,
seenIds=new Set()
){

try{

const {data:html}=
await axios.get(
WEBSITE_URL,
{
timeout:20000,
headers:{
'User-Agent':
'Mozilla/5.0'
}
}
);

const $=
cheerio.load(html);

const posts=[];

$('a').each((_,el)=>{

const title=
$(el)
.text()
.trim();

const href=
$(el)
.attr('href');

if(
!title ||
title.length<15
){
return;
}

const id=
'web_'+
hash(
title+href
);

if(
seenIds.has(id)
){
return;
}

posts.push({

id,

source:
'website',

title,

description:
title,

link:
href?.startsWith('http')
?href
:`https://www.titularizadora.com${href}`,

imageUrl:null

});

});

return posts.slice(
0,
max
);

}
catch(err){

throw new Error(
`WebsiteScraper: ${err.message}`
);

}

}

}

module.exports=
new WebsiteScraper();