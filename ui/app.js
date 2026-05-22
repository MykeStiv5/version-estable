'use strict';

document.addEventListener('DOMContentLoaded',()=>{

    // ======================================
    // ELEMENTOS
    // ======================================

    const whatsappStatus=
    document.getElementById('whatsappStatus');

    const instagramStatus=
    document.getElementById('instagramStatus');

    const systemStatus=
    document.getElementById('systemStatus');

    const systemDot=
    document.getElementById('systemDot');

    const qrImage=
    document.getElementById('qrImage');

    const qrWaiting=
    document.getElementById('qrWaiting');

    const startBtn=
    document.getElementById('startBotBtn');

    const activityTable=
    document.getElementById(
        'activityTableBody'
    );

    // MANUAL

    const manualTitle=
    document.getElementById(
        'manualTitle'
    );

    const manualDescription=
    document.getElementById(
        'manualDescription'
    );

    const manualLink=
    document.getElementById(
        'manualLink'
    );

    const manualImage=
    document.getElementById(
        'manualImage'
    );

    const sendManualBtn=
    document.getElementById(
        'sendManualBtn'
    );

    // PROCESOS

    const processRSSText=
    document.getElementById(
        'processRSSText'
    );

    const processMSGText=
    document.getElementById(
        'processMSGText'
    );

    const processWAText=
    document.getElementById(
        'processWAText'
    );


    // ======================================
    // BOT START
    // ======================================

    startBtn.addEventListener(
        'click',
        async()=>{

            try{

                await window.botAPI.startBot();

                addActivity(
                    'Sistema',
                    'Bot iniciado'
                );

            }
            catch(err){

                addActivity(
                    'Error',
                    err.message
                );

            }

        }
    );


    // ======================================
    // ENVÍO MANUAL
    // ======================================

    sendManualBtn.addEventListener(
        'click',
        ()=>{

            const data={

                title:
                manualTitle.value,

                description:
                manualDescription.value,

                link:
                manualLink.value,

                imageData:null

            };

            console.log(
                'ENVIANDO:',
                data
            );

            window.botAPI.sendManual(
                data
            );

            addActivity(
                'Manual',
                'Mensaje agregado a cola'
            );

            manualTitle.value='';
            manualDescription.value='';
            manualLink.value='';

        }
    );


    // ======================================
    // QR
    // ======================================

    window.botAPI.onWhatsAppQR(

        qr=>{

            qrImage.src=qr;

            qrImage.style.display=
            'block';

            qrWaiting.style.display=
            'none';

            addActivity(
                'WhatsApp',
                'QR generado'
            );

        }

    );


    // ======================================
    // WA STATUS
    // ======================================

    window.botAPI.onWhatsAppStatus(

        status=>{

            if(
                status==='CONNECTED'
            ){

                whatsappStatus.textContent=
                'CONECTADO';

                processWAText.textContent=
                'Conectado';

                systemStatus.textContent=
                'Sistema activo';

                systemDot.style.background=
                '#22c55e';

            }

            if(
                status==='DISCONNECTED'
            ){

                whatsappStatus.textContent=
                'DESCONECTADO';

                processWAText.textContent=
                'Sin conexión';

                systemDot.style.background=
                '#ef4444';

            }

        }

    );


    // ======================================
    // SCRAPER
    // ======================================

    window.botAPI.onScraperNew(

        posts=>{

            instagramStatus.textContent=
            'ACTIVO';

            processRSSText.textContent=
            `${posts.length} encontrados`;

            addActivity(

                'Scraper',

                `${posts.length} posts nuevos`

            );

        }

    );


    // ======================================
    // QUEUE
    // ======================================

    window.botAPI.onQueueSent(

        item=>{

            processMSGText.textContent=
            'Mensaje enviado';

            addActivity(

                'WhatsApp',

                'Mensaje enviado'

            );

        }

    );



    window.botAPI.onQueueFailed(

        data=>{

            processMSGText.textContent=
            'Error envío';

            addActivity(

                'Error',

                data.error

            );

        }

    );


    // ======================================
    // LOGS
    // ======================================

    window.botAPI.onLogs(

        log=>{

            addActivity(

                log.source||'Sistema',

                log.message||''

            );

        }

    );


    // ======================================
    // TABLA
    // ======================================

    function addActivity(

        process,
        detail

    ){

        const row=
        document.createElement(
            'tr'
        );

        row.innerHTML=`

        <td>
        ${new Date()
        .toLocaleTimeString()}
        </td>

        <td>
        ${process}
        </td>

        <td>
        ${detail}
        </td>

        `;

        activityTable.prepend(
            row
        );

    }

});