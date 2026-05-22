'use strict';

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');

const { bus, EVENTS } = require('../../shared/EventBus');

class WhatsAppService {

    constructor() {

        this.client = null;

        this.ready = false;
        this.initializing = false;

        this._alreadyReady = false;
        this._eventsBound = false;

    }

    get isReady() {
        return this.ready;
    }

    async initialize() {

        if (
            this.initializing ||
            this.ready ||
            this.client
        ) {

            console.log(
                '[WA] initialize ignorado'
            );

            return;
        }

        this.initializing = true;

        console.log(
            '[WA] Inicializando...'
        );

        try {

            this.client = new Client({

                authStrategy:new LocalAuth({

                    dataPath:path.join(
                        process.cwd(),
                        '.wwebjs_auth'
                    )

                }),

                puppeteer:{

                    headless:true,

                    args:[

                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-gpu'

                    ]

                }

            });

            this._bindEvents();

            await this.client.initialize();

        }

        catch(err){

            console.error(
                '[WA INIT ERROR]',
                err
            );

            await this._reset();

            setTimeout(

                ()=>this.initialize(),
                5000

            );

        }

    }

    _bindEvents(){

        if(
            this._eventsBound
        ){
            return;
        }

        this._eventsBound=true;

        const c=this.client;

        c.on(

            'qr',

            async(qr)=>{

                console.log(
                    '[WA] QR generado'
                );

                const qrBase64=
                await qrcode.toDataURL(
                    qr
                );

                bus.emit(
                    EVENTS.WA_QR,
                    qrBase64
                );

            }

        );

        c.on(

            'authenticated',

            ()=>{

                console.log(
                    '[WA] AUTH OK'
                );

            }

        );

        c.on(

            'ready',

            ()=>{

                console.log(
                    '[WA] READY'
                );

                this.ready=true;
                this.initializing=false;

                if(
                    this._alreadyReady
                ){
                    return;
                }

                this._alreadyReady=true;

                bus.emit(
                    EVENTS.WA_READY
                );

            }

        );

        c.on(

            'auth_failure',

            async(msg)=>{

                console.error(
                    '[WA AUTH FAIL]',
                    msg
                );

                bus.emit(
                    EVENTS.WA_AUTH_FAILURE,
                    msg
                );

                await this._reset();

            }

        );

        c.on(

            'disconnected',

            async(reason)=>{

                console.warn(
                    '[WA DISCONNECTED]',
                    reason
                );

                bus.emit(
                    EVENTS.WA_DISCONNECTED,
                    reason
                );

                await this._reset();

                setTimeout(

                    ()=>this.initialize(),
                    5000

                );

            }

        );

    }

    async sendMessage(
        chatId,
        text
    ){

        if(
            !this.ready ||
            !this.client
        ){

            throw new Error(
                'WhatsApp no listo'
            );

        }

        return this.client.sendMessage(
            chatId,
            text
        );

    }

    // =====================================
    // NUEVO FIX MEDIA
    // =====================================

    async sendMediaMessage(
        chatId,
        imageData,
        caption=''
    ){

        if(
            !this.ready ||
            !this.client
        ){

            throw new Error(
                'WhatsApp no listo'
            );

        }

        try{

            const {
                MessageMedia
            }=
            require(
                'whatsapp-web.js'
            );

            let media;

            // URL remota
            if(

                typeof imageData==='string' &&
                (
                    imageData.startsWith(
                        'http://'
                    ) ||

                    imageData.startsWith(
                        'https://'
                    )
                )

            ){

                media=
                await MessageMedia
                .fromUrl(
                    imageData
                );

            }

            // Base64/local
            else{

                media=
                new MessageMedia(

                    imageData.mimetype,

                    imageData.data,

                    imageData.filename||
                    'image.jpg'

                );

            }

            return await this.client
            .sendMessage(

                chatId,
                media,

                {
                    caption
                }

            );

        }

        catch(err){

            console.error(

                '[WA MEDIA ERROR]',
                err.message

            );

            throw err;

        }

    }

    async _reset(){

        this.ready=false;
        this.initializing=false;

        this._alreadyReady=false;
        this._eventsBound=false;

        try{

            if(
                this.client
            ){

                await this.client.destroy();

            }

        }
        catch(_){}

        this.client=null;

    }

}

module.exports=
new WhatsAppService();