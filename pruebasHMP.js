//  -   -   -   -   -   -   -   -   -   -    I M P R I M E - L I N E A -   -   -   -   -   -   -   -   -   -
Object.defineProperty(global, '__stack', {
    get: function () {
        var orig = Error.prepareStackTrace;
        Error.prepareStackTrace = function (_, stack) {
            return stack;
        };
        var err = new Error();
        Error.captureStackTrace(err, arguments.callee);
        var stack = err.stack;
        Error.prepareStackTrace = orig;
        return stack;
    },
});

Object.defineProperty(global, '__line', {
    get: function () {
        return __stack[1].getLineNumber();
    },
});

Object.defineProperty(global, '__function', {
    get: function () {
        return __stack[1].getFunctionName();
    },
});

//  -   -   -   -   -   -   -   E R R O R - N O - T R A T A D O -   -   -   -   -   -  -   -  -  -

process
    .on('uncaughtException', async (error) => {
        await sendXiraEmailError(error);
        console.error(`Se envió notificación de la falla: ${error.stack || error}`);
    })
    .on('unhandledRejection', async (error) => {
        await sendXiraEmailError(error);
        console.error(`Se envió notificación de la falla: ${error.stack || error}`);
    });

//  -   -   -   -   -   -   -   -   -   -   -   -   -   NODE MODULES  -   -   -   -   -   -   -   -   -   -   -   -   -

const puppeteer = require('puppeteer');
const sleep = require('sleep-promise');
const dotenv = require("dotenv");
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
dotenv.config();
(async () => {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.goto(process.env.HMP_URL, { waitUntil: 'networkidle2', timeout: 180000 });
    await page.waitForSelector("input[name='j_username']");
    await page.type("input[id='j_username']", process.env.USERHMP, { delay: 100 });
    await page.waitForSelector("input[name='j_password']");
    await page.type("input[id='j_password']", process.env.PASSHMP, { delay: 100 });
    await page.click("#signIn");

    const url = await page.url();
    if (url == process.env.HMP_LOGINEXP) {
        console.log("Las credenciales han expirado")
        const messageScreenshot = {};
        const screenshotBase64 = await page.screenshot({
            fullPage: true,
            encoding: 'base64',
        });
        messageScreenshot.content = screenshotBase64;
        messageScreenshot.filename = 'screenshot.png';
        messageScreenshot.encoding = 'base64';
        await sendXiraEmailError("Problema al iniciar sesión en plataforma HMP, las credenciales han expirado.<br><br>", { attachments: [messageScreenshot] });
        await browser.close();
    } else {
        /*
        await page.waitForSelector("#treemenu1 > li:nth-child(2)", { timeout: 18000 })
        await page.click("#treemenu1 > li:nth-child(2)");
        await sleep(5000)
        await page.waitForSelector("#treemenu1 > li:nth-child(2) > ul > li:nth-child(7) > a", { timeout: 18000 });
        await page.click("#treemenu1 > li:nth-child(2) > ul > li:nth-child(7) > a");*/
        let numleyendasarchivo = 1125
        let numleyendas = 0
        await page.goto(process.env.HMP_CARGA, { waitUntil: 'networkidle2', timeout: 180000 });
        await sleep(10000)
        let taskname="CHUBB 23-09-2021_2"
        try {
            //Cambiamos al frame donde aparece el botón de descarga
            /*let iframe = await cambiarFrameCargaHMP(page)
            await iframe.waitForSelector("#descFileForm > table > tbody > tr > td > div > table > tbody > tr > td > div:nth-child(1) > div > div:nth-child(2) > input", { timeout: 18000 })
            await sleep(5000)
            let taskname = "archivobueno4"
            console.log("click boton")
            const [fileChooser] = await Promise.all([
                page.waitForFileChooser(),
                //Se da click botón "Browse for description file"
                await page.mouse.click(29, 120),
                console.log("Abre filechooser"),
            ])

            await fileChooser.accept([path.join(process.env.PLANTILLAS_CARGA, taskname + ".csv")]);
            console.log("Se ha cargado el archivo, ejecutando botón de proceso...")

            //Se da click botón "Process File"
            await page.mouse.click(300, 120)
            await sleep(3000)

            //Mensaje de confirmación
            //
            //body > div[id='infoContainer'] > div > div[id='infoCDiv'] >div[id='infoContentDiv'] > table[id='infoContentTable'] > tbody > tr:nth-child(2) > td > form[id='processForm'] > table[id='processForm\:fileMessage'] >tbody > tr:nth-child(3) > td > input[type=submit]
            */
            await page.waitForSelector("#header > table:nth-child(1) > tbody > tr:nth-child(2) > td > ul > li:nth-child(2) > a", { timeout: 18000 })
            await page.click("#header > table:nth-child(1) > tbody > tr:nth-child(2) > td > ul > li:nth-child(2) > a")
            console.log("Buscando barras de progreso")
            await sleep(5000)


            //Tabla de tareas con barras de progreso
            iframe = await cambiarFrameProgresoHMP(page)
            await sleep(5000)
            await iframe.waitForSelector("table[id='descFileProcessFrm\:processDescTable\:n'] > tbody > tr", { timeout: 18000 })
            const t = (await iframe.$$("table[id='descFileProcessFrm\:processDescTable\:n'] > tbody > tr")).length
            let statusproceso = ""
            let anchor = ""
            for (let j = 0; j < t; j++) {
                //Fila actual
                console.log("Nueva fila " + j)
                //#descFileProcessFrm\:processDescTable\:2\:j_id_jsp__14743123623
                //processDescTable\:0\:j_id_jsp_474312362_10 > div
                //ACTUAL: tr[id='descFileProcessFrm\:processDescTable\:n\:0'] > td[id='descFileProcessFrm\:processDescTable\:0\:j_id_jsp_474312362_13'] > div
                //"tr[id='descFileProcessFrm\:processDescTable\:n\:0'] > td[id='descFileProcessFrm\:processDescTable\:0\:j_id_jsp_2132229671_13'] > div"
                let selector_actual = "tr[id='descFileProcessFrm\:processDescTable\:n\:" + j + "']"
                await iframe.waitForSelector(selector_actual, { timeout: 18000 })
                let element=""
                try{
                    console.log("Usando selector original")
                    selector="474312362"
                    element = await iframe.waitForSelector(selector_actual + "> td[id='descFileProcessFrm\:processDescTable\:" + j + "\:j_id_jsp_"+selector+"_13'] > div", { timeout: 18000 })
                }
                catch(e){
                    console.log("No se encontró, usando selector alterno")
                    selector="1274847915"
                    element = await iframe.waitForSelector(selector_actual + "> td[id='descFileProcessFrm\:processDescTable\:" + j + "\:j_id_jsp_"+selector+"_13'] > div", { timeout: 18000 })
                }
                
                //Buscamos título
                let titulotareaproceso = await element.evaluate(el => el.textContent);
                console.log(titulotareaproceso)

                console.log("Titulo tarea: " + titulotareaproceso)

                if (titulotareaproceso == taskname + ".csv") {
                    console.log("Titulo de tarea encontrado")
                    //#descFileProcessFrm\:processDescTable\:3\:j_id_jsp_2132229671_31 > div > input[type=submit]     
                    //await iframe.waitForSelector(selector_actual + "> td[id='descFileProcessFrm\:processDescTable\:" + j + "\:j_id_jsp_2132229671_31'] > div > input[type=submit]")
                    //console.log("Boton cancelar encontrado, es el archivo correcto")

                    //Se verifica status de proceso
                    anchor = await iframe.waitForSelector(selector_actual + "> td[id='descFileProcessFrm\:processDescTable\:" + j + "\:j_id_jsp_"+selector+"_19'] > div > a")
                    statusproceso = await anchor.evaluate(el => el.textContent);

                    //Actualizar mientras el status de carga no cambie
                    do {
                        console.log("Todavía no se acaba de cargar, esperando a carga....")
                        anchor = await iframe.waitForSelector(selector_actual + "> td[id='descFileProcessFrm\:processDescTable\:" + j + "\:j_id_jsp_"+selector+"_19'] > div > a")
                        statusproceso = await anchor.evaluate(el => el.textContent);
                    }
                    while (statusproceso == "WAIT" || statusproceso == "VALIDATING" || statusproceso == "PERSISTING");

                    //Obtenemos el numero de leyendas cargadas
                    let nl = await iframe.waitForSelector(selector_actual + "> td[id='descFileProcessFrm\:processDescTable\:" + j + "\:j_id_jsp_"+selector+"_16'] > div")
                    numleyendas = await nl.evaluate(el => el.textContent);

                    //Si fue exitoso
                    if (statusproceso == "SUCCESS") {
                        //Verificamos numero de leyendas de archivo con numero de leyendas de programa
                        if (numleyendas != numleyendasarchivo) {
                            console.log("Error cargando leyendas, no coincide numero de leyendas generadas con número de leyendas cargadas")
                        } else {
                            console.log("Exito cargando leyendas, archivo preparado para liberación en DAT")
                        }
                    } else {
                        console.log("Error cargando archivo")
                    }
                    break

                } else {
                    console.log("titulo no corresponde, se sigue buscando")
                    continue

                }
            }

            await page.goto(process.env.HMP_CARGA, { waitUntil: 'networkidle2', timeout: 180000 });
            await page.waitForSelector("#header > table:nth-child(1) > tbody > tr:nth-child(1) > td:nth-child(2) > table > tbody > tr > td:nth-child(1) > a", {timeout: 180000 })
            await page.click("#header > table:nth-child(1) > tbody > tr:nth-child(1) > td:nth-child(2) > table > tbody > tr > td:nth-child(1) > a")
            await browser.close();
            //WAIT - VALIDATING - NO HA TERMINADO
            //SUCCESS - EXITO
            //FAIL - ERROR EN CARGA
            /*
 
           */
        } catch (error) {
            console.log(error)
            await browser.close();
            console.log("Fin error")
        }
    }
})().catch((e) => {
    console.log("EL RPA HA DETECTADO UN ERROR!")
    console.log(e);
    console.log("Favor de revisar")
});


async function cambiarFrameCargaHMP(page, config = { intentos: 10, delay: 5000, ciclo: 0 }) {
    let intentos = config.intentos ? config.intentos : 10
    let delay = config.delay ? config.delay : 5000
    let ciclo = config.ciclo ? config.ciclo : 0


    if (ciclo < intentos) {
        await sleep(delay)
        await page.waitForSelector("#desc")
        let iframe = null
        const iframeList = page.frames();
        iframeList.map((frame) => {
            if ((frame['_name']) == "desc") iframe = frame;
        });
        if (iframe) {
            return iframe
        }
        else {
            config.ciclo = ciclo + 1
            return cambiarFrameCargaHMP(page, config)
        }
    }
    else {
        return false
    }
}

async function cambiarFrameProgresoHMP(page, config = { intentos: 10, delay: 5000, ciclo: 0 }) {
    let intentos = config.intentos ? config.intentos : 10
    let delay = config.delay ? config.delay : 5000
    let ciclo = config.ciclo ? config.ciclo : 0


    if (ciclo < intentos) {
        await sleep(delay)
        await page.waitForSelector("#idFrmDescFileProcess")
        let iframe = null
        const iframeList = page.frames();
        iframeList.map((frame) => {
            if ((frame['_name']) == "idFrmDescFileProcess") iframe = frame;
        });
        if (iframe) {
            return iframe
        }
        else {
            config.ciclo = ciclo + 1
            return cambiarFrameProgresoHMP(page, config)
        }
    }
    else {
        return false
    }
}


async function sendXiraEmailError(error, config = { attachments: [] }) {
    const mailOptions = {
        from: 'ALERTA HMP  <infobot@xira-intelligence.com>',
        to: 'areyes@xira.ai',
        subject: 'ERROR PLATAFORMA CARGA HMP!!!',
        text: '',
        html: `ERROR:<br>${error.stack || error}`,
        attachments: config.attachments,
    };

    const transporter = nodemailer.createTransport({
        host: process.env.HOST_EMAIL,
        secure: false,
        auth: {
            user: process.env.CORREO,
            pass: process.env.PASS_MAIL,
        },
    });

    return new Promise((resolve) => {
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error(`Funcion: ${__function} - Linea: ${__line} - Error: ${error.stack || error}`);
                resolve();
                return;
            }
            console.log(JSON.stringify(info));
            console.log("Se envia correo a soporte.convenios@posadas.com")
            resolve();
            return;
        });
    });
}