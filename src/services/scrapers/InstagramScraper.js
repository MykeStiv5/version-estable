'use strict';

const fs=require('fs');
const path=require('path');

const INSTAGRAM_URL=
'https://www.instagram.com/titularizadora.colombiana/';

class InstagramScraper{

    constructor(){

        this.seenPath=
        path.join(
            process.cwd(),
            'storage',
            'ig_seen.json'
        );

        this.seen=
        new Set();

        this._loadSeen();

    }

    //=========================
    // SEEN
    //=========================

    _loadSeen(){

        try{

            if(
                fs.existsSync(
                    this.seenPath
                )
            ){

                this.seen=
                new Set(

                    JSON.parse(

                        fs.readFileSync(
                            this.seenPath,
                            'utf8'
                        )

                    )

                );

            }

        }
        catch(_){

            this.seen=
            new Set();

        }

    }

    _saveSeen(){

        try{

            fs.mkdirSync(

                path.dirname(
                    this.seenPath
                ),
                {
                    recursive:true
                }

            );

            fs.writeFileSync(

                this.seenPath,

                JSON.stringify(

                    [...this.seen]
                    .slice(-1000)

                )

            );

        }
        catch(_){}

    }

    //=========================
    // SCRAPE
    //=========================

    async scrape(
        page,
        max=5,
        externalSeen=new Set()
    ){

        try{

            await page.goto(

                INSTAGRAM_URL,

                {
                    waitUntil:'networkidle',
                    timeout:60000
                }

            );

            await page.waitForTimeout(
                4000
            );

            const loginRequired=
            page.url()
            .includes(
                '/accounts/login'
            );

            if(
                loginRequired
            ){

                console.log(
                    '[IG] esperando login'
                );

                return [];
            }

            await page.mouse.wheel(
                0,
                3000
            );

            await page.waitForTimeout(
                3000
            );

            const posts=
            await page.evaluate(
            max=>{

                const links=
                [...document.querySelectorAll('a')];

                const filtered=
                links.filter(

                    a=>

                    a.href &&
                    (
                        a.href.includes('/p/') ||
                        a.href.includes('/reel/')
                    )

                );

                const unique=
                [...new Map(

                    filtered.map(

                        x=>[
                            x.href,
                            x
                        ]

                    )

                ).values()];

                return unique
                .slice(0,max)
                .map(a=>{

                    const href=
                    a.href;

                    const code=
                    href
                    .split('/')
                    .filter(Boolean)
                    .pop();

                    return{

                        id:
                        'ig_'+code,

                        source:
                        'instagram',

                        title:
                        'Instagram',

                        description:
                        'Nueva publicación',

                        link:
                        href,

                        imageUrl:
                        null

                    };

                });

            },max);

            const fresh=[];

            for(
                const p of posts
            ){

                const exists=

                    this.seen.has(
                        p.id
                    ) ||

                    externalSeen.has(
                        p.id
                    );

                if(
                    exists
                ){
                    continue;
                }

                this.seen.add(
                    p.id
                );

                fresh.push(
                    p
                );

            }

            this._saveSeen();

            console.log(
                `[IG] nuevos: ${fresh.length}`
            );

            return fresh;

        }
        catch(err){

            console.log(
                '[IG ERROR]',
                err.message
            );

            return[];

        }

    }

}

module.exports=
new InstagramScraper();