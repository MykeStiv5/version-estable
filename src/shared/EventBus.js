'use strict';

const { EventEmitter } = require('events');

const EVENTS = Object.freeze({

    // WhatsApp
    WA_QR:'wa:qr',
    WA_READY:'wa:ready',
    WA_DISCONNECTED:'wa:disconnected',
    WA_AUTH_FAILURE:'wa:auth_failure',

    // Queue
    QUEUE_SENT:'queue:sent',
    QUEUE_FAILED:'queue:failed',

    // Scraper
    SCRAPER_NEW_POSTS:'scraper:new_posts',
    SCRAPER_ERROR:'scraper:error',
    SCRAPER_CYCLE_DONE:'scraper:done',

    // Bot
    BOT_STARTED:'bot:started',
    BOT_STOPPED:'bot:stopped',

    LOG:'system:log'
});

class EventBus extends EventEmitter{

    constructor(){
        super();
        this.setMaxListeners(100);
    }

    safeEmit(event,data){

        try{

            this.emit(
                event,
                data
            );

        }
        catch(err){

            console.log(
                '[EventBus]',
                err.message
            );

        }

    }

}

const bus=new EventBus();

module.exports={
    bus,
    EVENTS
};