require('dotenv').config();
'use strict';

const fs = require('fs');
const path = require('path');

const { createSourceLogger } = require('../Logger');
const log = createSourceLogger('WhatsAppQueue');

const waService = require('./WhatsAppService');

const {
    bus,
    EVENTS
} = require('../../shared/EventBus');


// ================= CONFIG =================

const TARGET_CHAT_ID =
process.env.TARGET_CHAT_ID ||
'120363408686646018@g.us';

const STORAGE_FILE=
path.join(
    process.cwd(),
    'storage',
    'queue.json'
);

const RETRY_DELAYS=[
    5000,
    15000,
    30000
];

const INTERVAL_IDLE=1500;


// ================= CLASS =================

class WhatsAppQueue{

    constructor(){

        this.queue=[];

        this.processing=false;
        this.paused=true;

        this._timer=null;

        this._load();
        this._bindEvents();

    }

    // ================= API =================

    enqueueText(
        text,
        chatId=TARGET_CHAT_ID
    ){

        return this._add({

            type:'text',
            chatId,
            text

        });

    }

    enqueueMedia(

        imageData,
        caption='',
        chatId=TARGET_CHAT_ID

    ){

        return this._add({

            type:'media',
            chatId,
            imageData,
            caption

        });

    }

    enqueuePost(

        post,
        chatId=TARGET_CHAT_ID

    ){

        const text=
        this._format(post);

        return this._add({

            type:
            post.imageUrl
            ?'media'
            :'text',

            chatId,

            text,

            imageData:
            post.imageUrl || null,

            caption:text

        });

    }

    start(){

        this.paused=false;

        log.info(
            'Queue START'
        );

        this._tick();

    }

    stop(){

        this.paused=true;

        if(this._timer){

            clearTimeout(
                this._timer
            );

        }

        this._timer=null;

        log.warn(
            'Queue STOP'
        );

    }


    // ================= EVENTS =================

    _bindEvents(){

        bus.on(
            EVENTS.WA_READY,
            ()=>{

                log.info(
                    'WA_READY → Queue resume'
                );

                this.paused=false;

                this._tick();

            }
        );

        bus.on(
            EVENTS.WA_DISCONNECTED,
            ()=>{

                log.warn(
                    'WA_DISCONNECTED → Queue pause'
                );

                this.paused=true;

            }
        );

    }


    // ================= LOOP =================

    _tick(){

        if(this._timer){
            return;
        }

        this._timer=
        setTimeout(

            async()=>{

                this._timer=null;

                await this._process();

                this._tick();

            },

            INTERVAL_IDLE
        );

    }


    async _process(){

        if(
            this.paused ||
            this.processing
        ){
            return;
        }

        if(
            !this.queue.length
        ){
            return;
        }

        const now=
        Date.now();

        const item=
        this.queue.find(

            m=>
            m.nextTryAt<=now

        );

        if(!item){
            return;
        }

        this.processing=true;

        try{

            if(
                !waService.isReady
            ){

                log.warn(
                    'WhatsApp no listo'
                );

                this.paused=true;

                return;

            }

            await this._send(
                item
            );

            this.queue=
            this.queue.filter(

                q=>q.id!==item.id

            );

            this._save();

            log.info(
                `SENT ${item.id}`
            );

            bus.emit(
                EVENTS.QUEUE_SENT,
                item
            );

        }

        catch(err){

            item.retries++;

            log.error(
                `FAIL ${item.id}: ${err.message}`
            );

            if(
                item.retries>=
                RETRY_DELAYS.length
            ){

                log.error(
                    `DEAD LETTER ${item.id}`
                );

                this.queue=
                this.queue.filter(

                    q=>q.id!==item.id

                );

            }

            else{

                item.nextTryAt=
                Date.now()+
                RETRY_DELAYS[
                    item.retries-1
                ];

            }

            this._save();

            bus.emit(
                EVENTS.QUEUE_FAILED,
                {
                    item,
                    error:err.message
                }
            );

        }

        this.processing=false;

    }


    async _send(item){

        if(
            item.type==='text'
        ){

            return await
            waService.sendMessage(

                item.chatId,
                item.text

            );

        }

        if(
            !item.imageData
        ){

            return await
            waService.sendMessage(

                item.chatId,
                item.caption

            );

        }

        return await
        waService.sendMediaMessage(

            item.chatId,
            item.imageData,
            item.caption

        );

    }


    // ================= INTERNAL =================

    _add(data){

        const item={

            id:
            `${Date.now()}_${Math.random()
            .toString(36)
            .slice(2,8)}`,

            retries:0,

            nextTryAt:0,

            createdAt:
            Date.now(),

            ...data

        };

        this.queue.push(
            item
        );

        this._save();

        log.info(
            `ENQUEUE ${item.id}`
        );

        this._tick();

        return item.id;

    }


    _format(post){

        return [

            post.title
            ?`*${post.title}*`
            :'',

            post.description||'',

            post.link
            ?`🔗 ${post.link}`
            :''

        ]

        .filter(Boolean)

        .join('\n\n');

    }


    // ================= STORAGE =================

    _load(){

        try{

            fs.mkdirSync(

                path.dirname(
                    STORAGE_FILE
                ),

                {
                    recursive:true
                }

            );

            if(

                fs.existsSync(
                    STORAGE_FILE
                )

            ){

                this.queue=
                JSON.parse(

                    fs.readFileSync(
                        STORAGE_FILE,
                        'utf8'
                    )

                );

            }

        }

        catch(e){

            log.error(
                'LOAD ERROR'
            );

            this.queue=[];

        }

    }


    _save(){

        try{

            fs.mkdirSync(

                path.dirname(
                    STORAGE_FILE
                ),

                {
                    recursive:true
                }

            );

            fs.writeFileSync(

                STORAGE_FILE,

                JSON.stringify(
                    this.queue,
                    null,
                    2
                )

            );

        }

        catch(e){

            log.error(
                'SAVE ERROR'
            );

        }

    }

}

module.exports=
new WhatsAppQueue();