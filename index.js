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

//  -   -   -   -   -   -   -   -   -   -   -   -   -   NODE MODULES  -   -   -   -   -   -   -   -   -   -   -   -   -
const puppeteer = require('puppeteer');
const sleep = require('sleep-promise');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');
const funciones = require('./funciones/funcionesConvenios');
//const V4funciones = require('./funciones/V4funcionesConvenios'); //PRUEBAS CHANCE
const funcionesBD = require('./funciones/funcionesBD');
const logger = require('node-logger').createLogger('logs_comisiones.txt');
dotenv.config();

//  -   -   -   -   -   -   -   E R R O R - N O - T R A T A D O -   -   -   -   -   -  -   -  -  -

process
    .on('uncaughtException', async (error) => {
        await funciones.sendXiraEmailError(error);
        console.error(`Se envió notificación de la falla: ${error.stack || error}`);
        await funcionesBD.insertaError(error.slice(0, 119), 'RPA Convenios', await funcionesBD.generaFechaSQL());
        console.log('Se ha registrado el error en BD');
        logger.info('Se ha registrado el error en BD');
    })
    .on('unhandledRejection', async (error) => {
        await funciones.sendXiraEmailError(error);
        console.error(`Se envió notificación de la falla: ${error.stack || error}`);
        await funcionesBD.insertaError(String(error).slice(0, 119), 'RPA Convenios', await funcionesBD.generaFechaSQL());
        console.log('Se ha registrado el error en BD');
        logger.info('Se ha registrado el error en BD');
    });
//'* */5 8,9,10,11,12,13,14,15,16,17,18 * *'
(async () => {
    while (true) {
        let totalleyendas = 0;
        let contadorliberados = 0;
        let inicioproceso = '';
        const d = new Date();
        let hour = d.getHours();
        let day = d.getDay();
        let minutes = d.getMinutes();
        let daysw = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
        let browser = undefined;
        console.log(daysw[day] + ' Hora: ' + hour + ':' + minutes);
        logger.info(daysw[day] + ' Hora: ' + hour + ':' + minutes);
        if (true) {
            // aqui se verifica la hora activa de oficina
            {
                console.log('Ventana de trabajo, comenzando proceso');
                logger.info('Ventana de trabajo, comenzando proceso');
                try {
                    await sleep(5000);
                    //Verificación de credenciales
                    let credencialesvalidas = await funciones.credentialCheckHMP();
                    if (credencialesvalidas) {
                        await funciones.checkUpdatedFiles();
                        inicioproceso = await funcionesBD.generaFechaSQL();
                        browser = await puppeteer.launch({ headless: true});
                        //browser = await puppeteer.launch({ headless: false });
                        let page = await browser.newPage();
                        //Configuración de descargas
                        await page._client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: path.normalize(process.env.DOWNLOAD_PATH) });
                        await page.setExtraHTTPHeaders({
                            'Accept-Language': 'es',
                        });
                        //Redirección a DAT
                        await page.goto(process.env.DAT_URL, { waitUntil: 'networkidle2' });

                        //Login
                        await page.waitForSelector("input[id='j_username::content']");
                        await page.type("input[id='j_username::content']", process.env.USERCONVENIOS, { delay: 100 });
                        await page.waitForSelector("input[id='j_password::content']");
                        await page.type("input[id='j_password::content']", process.env.PASSCONVENIOS, { delay: 100 });
                        await page.click('#loginButton');

                        await sleep(15000);

                        let urlFail = await page.url();
                        while (urlFail == process.env.DAT_FAIL) {
                            console.log('Reintentando Login!');
                            logger.info('Reintentando Login!');
                            await page.waitForSelector("input[id='j_username::content']");
                            await page.type("input[id='j_username::content']", process.env.USERCONVENIOS, { delay: 100 });
                            await page.waitForSelector("input[id='j_password::content']");
                            await page.type("input[id='j_password::content']", process.env.PASSCONVENIOS, { delay: 100 });
                            await page.click('#loginButton');

                            await sleep(15000);
                            urlFail = await page.url();
                        }

                        //Espera y cuenta de tareas en plataforma
                        /*
                            #wlctdc\:j_id__ctru10\:r1\:0\:tldc\:taskTable\:crhj1j_id_2 > div.x1ko > span

#wlctdc\:j_id__ctru10\:r1\:0\:tldc\:taskTable\:crhj1j_id_2\:\:afrSI > tbody > tr > td:nth-child(1) > a

await page.waitForSelector("th[id='wlctdc:j_id__ctru10:r1:0:tldc:taskTable:j_id__ctru156pc24:2:crhj1'] > div.x1ko > span", { timeout: 300000 });
                        await page.click("th[id='wlctdc:j_id__ctru10:r1:0:tldc:taskTable:j_id__ctru156pc24:2:crhj1'] > div.x1ko > span");
                        //Flecha ordenar ascendente
                        await page.waitForSelector("table[id='wlctdc:j_id__ctru10:r1:0:tldc:taskTable:j_id__ctru156pc24:2:crhj1::afrSI'] > tbody > tr > td:nth-child(1) > a", { timeout: 300000 });
                        await page.click("table[id='wlctdc:j_id__ctru10:r1:0:tldc:taskTable:j_id__ctru156pc24:2:crhj1::afrSI'] > tbody > tr > td:nth-child(1) > a");

                        */

                        await page.waitForSelector("th[id='wlctdc:j_id__ctru10:r1:0:tldc:taskTable:crhj1j_id_2'] > div.x1ko > span", { timeout: 0 }); // original: { timeout: 300000 }
                        await page.click("th[id='wlctdc:j_id__ctru10:r1:0:tldc:taskTable:crhj1j_id_2'] > div.x1ko > span");
                        //Flecha ordenar ascendente
                        await page.waitForSelector("table[id='wlctdc:j_id__ctru10:r1:0:tldc:taskTable:crhj1j_id_2::afrSI'] > tbody > tr > td:nth-child(1) > a", { timeout: 300000 });
                        await page.click("table[id='wlctdc:j_id__ctru10:r1:0:tldc:taskTable:crhj1j_id_2::afrSI'] > tbody > tr > td:nth-child(1) > a");

                        await page.waitForSelector("div[id='wlctdc:j_id__ctru10:r1:0:tldc:taskTable::db'] > table:nth-child(1)");
                        let longitudReal = await page.evaluate(() => document.querySelector("div[id='wlctdc:j_id__ctru10:r1:0:tldc:taskTable::db'] > table:nth-child(1)").getAttribute('_rowcount'));
                        console.log('Hay ' + longitudReal + ' tareas en DAT');
                        logger.info('Hay ' + longitudReal + ' tareas en DAT');
                        let t = (await page.$$("div[id='wlctdc:j_id__ctru10:r1:0:tldc:taskTable::db'] > table > tbody > tr")).length;

                        let taskarray = [];
                        let taskarray2 = [];
                        let descargados = [];
                        let correctos = [];
                        let archivos = [];
                        let observacionesGDL = [];
                        let numLeyendas = [];
                        let contratos = [];
                        let contadordescargas = 0;
                        let cuentas = [];
                        let numsols = [];
                        contadorliberados = 0;
                        let tareasError = await funcionesBD.conseguirTareasError();
                        await sleep(5000);
                        let longerror = tareasError.length;
                        //let longerror = 0
                        //Si hay tareas detectadas, las descarga
                        let blockSize = Number(process.env.BLOCKSIZE);
                        if (t > 0) {
                            if (t <= blockSize) blockSize = t - longerror;
                            if (longitudReal > 20) {
                                if (longitudReal > 23 + longerror + 1) {
                                    for (let j = t; j < t + (blockSize + longerror); j++) {
                                        // console.log(j)
                                        await page.waitForSelector("table[id='wlctdc:j_id__ctru10:r1:0:tldc:taskTable:" + j + ":pgdjl1'] > tbody > tr > td > span", { timeout: 300000 });

                                        //Por cada elemento, recuperamos el titulo
                                        let data = await page.evaluate((j) => {
                                            const spans = Array.from(document.querySelectorAll("table[id='wlctdc:j_id__ctru10:r1:0:tldc:taskTable:" + j + ":pgdjl1'] > tbody > tr > td > span"));
                                            return spans.map((span) => span.innerText);
                                        }, j);
                                        data[0] = data[0].replace('Validate Rates Load ', '').replace('Validates Load of Rates ', '').replace('Validar carga de tarifas ', '').replace('Validar Carga de Tarifas ', '');
                                        taskarray.push(data[0]);
                                        console.log('Tarea localizada: ' + data[0]);
                                        logger.info('Tarea localizada: ' + data[0]);
                                        await page.click("table[id='wlctdc:j_id__ctru10:r1:0:tldc:taskTable:" + j + ":pgdjl1']");
                                    }
                                    await sleep(4000);
                                    //Por cada tarea detectada, seleccionamos el recuadro correspondiente
                                    //let i = t-1; i > (t-1)-blockSize; i--
                                    let contadorTareas = 0;
                                    for (let i = t; i < t + (blockSize + longerror); i++) {
                                        if (!tareasError.includes(taskarray[contadorTareas])) {
                                            await page.waitForSelector("table[id='wlctdc:j_id__ctru10:r1:0:tldc:taskTable:" + i + ":pgdjl1'] ");
                                            await page.click("table[id='wlctdc:j_id__ctru10:r1:0:tldc:taskTable:" + i + ":pgdjl1']");
                                            await sleep(5500);
                                            let rutaarchivo = path.join(process.env.DOWNLOAD_PATH, taskarray[contadorTareas] + process.env.EXTENSION);
                                            {
                                                console.log('Nuevo archivo para descargar');
                                                logger.info('Nuevo archivo para descargar');
                                                await sleep(5500);
                                                try {
                                                    //Cambiamos al frame donde aparece el botón de descarga
                                                    let iframe = await funciones.cambiarFrameDescargaDocumento(page);
                                                    let filedescarga;
                                                    if (iframe) {
                                                        let banderaDescargaxlsx = false;
                                                        let contDescarga = 0;
                                                        do {
                                                            //Se le da click al botón de descarga
                                                            if (contDescarga == 0) {
                                                                try {
                                                                    console.log('USANDO SELECTOR POR DEFECTO');
                                                                    logger.info('USANDO SELECTOR POR DEFECTO');
                                                                    await iframe.waitForSelector("div[id='pt1:r1:0:pt1:r1:0:bRS_BD']", { timeout: 15000 });
                                                                    await iframe.click("img[id='pt1:r1:0:pt1:r1:0:bRS_BD::icon']");
                                                                } catch (error) {
                                                                    console.log('USANDO SELECTOR ALTERNO');
                                                                    logger.info('USANDO SELECTOR ALTERNO');
                                                                    try {
                                                                        await iframe.waitForSelector("div[id='pt1:r1:0:ptVRL:r2:0:bBD']", { timeout: 300000 });
                                                                        //await iframe.click("img[id='pt1:r1:0:ptVRL:r2:0:bBD::icon']");
                                                                        await iframe.click("div[id='pt1:r1:0:ptVRL:r2:0:bBD']");
                                                                    } catch (error) {
                                                                        console.log('No se pudo descargar archivo, selector desconocido');
                                                                        logger.log('No se pudo descargar archivo, selector desconocido');
                                                                    }
                                                                }
                                                            }
                                                            //Verificamos si el archivo ya se descargó

                                                            let pathDescarga;
                                                            await sleep(5500);
                                                            let arreglodesc = process.env.FILE_DESCARGA.split('|');

                                                            arreglodesc.forEach((arch) => {
                                                                pathDescarga = path.normalize(path.join(process.env.DOWNLOAD_PATH, arch));
                                                                if (fs.existsSync(pathDescarga)) {
                                                                    filedescarga = arch;
                                                                    banderaDescargaxlsx = fs.existsSync(pathDescarga);
                                                                }
                                                            });

                                                            //const pathDescarga = path.normalize(path.join(process.env.DOWNLOAD_PATH, process.env.FILE_DESCARGA));

                                                            contDescarga++;
                                                            await sleep(500);
                                                        } while (!banderaDescargaxlsx && contDescarga < 12);
                                                        if (banderaDescargaxlsx) {
                                                            console.log('Archivo descargado');
                                                            logger.info('Archivo descargado');
                                                            fs.renameSync(path.join(process.env.DOWNLOAD_PATH, filedescarga), path.join(process.env.DOWNLOAD_PATH, taskarray[contadorTareas] + process.env.EXTENSION));
                                                            console.log('Archivo renombrado');
                                                            logger.info('Archivo renombrado');
                                                            contadordescargas++;
                                                        }
                                                        descargados.push(banderaDescargaxlsx);
                                                    } else {
                                                        console.log('No se encotró iframe, se omite');
                                                        logger.info('No se encotró iframe, se omite');
                                                        descargados.push(false);
                                                    }
                                                } catch (error) {
                                                    console.log('Ha ocurrido un error: ' + error + '\nSe omite descarga');
                                                    logger.info('Ha ocurrido un error: ' + error + '\nSe omite descarga');
                                                    descargados.push(false);
                                                }
                                            }
                                        } else {
                                            console.log('Se omite tarea errónea o que no es de prueba.');
                                            logger.info('Se omite tarea errónea o que no es de prueba.');
                                            descargados.push(false);
                                        }
                                        contadorTareas++;
                                    }
                                } else {
                                    for (let j = longitudReal - 1; j > longitudReal - 1 - (blockSize + longerror); j--) {
                                        //console.log(j)
                                        await page.waitForSelector("table[id='wlctdc:j_id__ctru10:r1:0:tldc:taskTable:" + j + ":pgdjl1'] > tbody > tr > td > span");

                                        //Por cada elemento, recuperamos el titulo
                                        let data = await page.evaluate((j) => {
                                            const spans = Array.from(document.querySelectorAll("table[id='wlctdc:j_id__ctru10:r1:0:tldc:taskTable:" + j + ":pgdjl1'] > tbody > tr > td > span"));
                                            return spans.map((span) => span.innerText);
                                        }, j);
                                        data[0] = data[0].replace('Validate Rates Load ', '').replace('Validates Load of Rates ', '').replace('Validar carga de tarifas ', '').replace('Validar Carga de Tarifas ', '');
                                        taskarray.push(data[0]);
                                        console.log('Tarea localizada: ' + data[0]);
                                        logger.info('Tarea localizada: ' + data[0]);
                                        await page.click("table[id='wlctdc:j_id__ctru10:r1:0:tldc:taskTable:" + j + ":pgdjl1']");
                                    }
                                    await sleep(4000);
                                    //Por cada tarea detectada, seleccionamos el recuadro correspondiente
                                    //let i = t-1; i > (t-1)-blockSize; i--
                                    let contadorTareas = 0;
                                    for (let i = longitudReal - 1; i > longitudReal - 1 - (blockSize + longerror); i--) {
                                        if (!tareasError.includes(taskarray[contadorTareas])) {
                                            await page.waitForSelector("table[id='wlctdc:j_id__ctru10:r1:0:tldc:taskTable:" + i + ":pgdjl1'] ");
                                            await page.click("table[id='wlctdc:j_id__ctru10:r1:0:tldc:taskTable:" + i + ":pgdjl1']");
                                            await sleep(5500);
                                            let rutaarchivo = path.join(process.env.DOWNLOAD_PATH, taskarray[contadorTareas] + process.env.EXTENSION);
                                            {
                                                console.log('Nuevo archivo para descargar');
                                                logger.info('Nuevo archivo para descargar');
                                                await sleep(5500);
                                                try {
                                                    //Cambiamos al frame donde aparece el botón de descarga
                                                    let iframe = await funciones.cambiarFrameDescargaDocumento(page);
                                                    let filedescarga;
                                                    if (iframe) {
                                                        let banderaDescargaxlsx = false;
                                                        let contDescarga = 0;
                                                        do {
                                                            //Se le da click al botón de descarga
                                                            if (contDescarga == 0) {
                                                                try {
                                                                    console.log('USANDO SELECTOR POR DEFECTO');
                                                                    logger.info('USANDO SELECTOR POR DEFECTO');
                                                                    await iframe.waitForSelector("div[id='pt1:r1:0:pt1:r1:0:bRS_BD']", { timeout: 15000 });
                                                                    await iframe.click("img[id='pt1:r1:0:pt1:r1:0:bRS_BD::icon']");
                                                                } catch (error) {
                                                                    console.log('USANDO SELECTOR ALTERNO');
                                                                    logger.info('USANDO SELECTOR ALTERNO');
                                                                    try {
                                                                        await iframe.waitForSelector("div[id='pt1:r1:0:ptVRL:r2:0:bBD']", { timeout: 300000 });
                                                                        //await iframe.click("img[id='pt1:r1:0:ptVRL:r2:0:bBD::icon']");
                                                                        await iframe.click("div[id='pt1:r1:0:ptVRL:r2:0:bBD']");
                                                                    } catch (error) {
                                                                        console.log('No se pudo descargar archivo, selector desconocido');
                                                                        logger.info('No se pudo descargar archivo, selector desconocido');
                                                                    }
                                                                }
                                                            }
                                                            //Verificamos si el archivo ya se descargó

                                                            let pathDescarga;
                                                            await sleep(5500);
                                                            let arreglodesc = process.env.FILE_DESCARGA.split('|');

                                                            arreglodesc.forEach((arch) => {
                                                                pathDescarga = path.normalize(path.join(process.env.DOWNLOAD_PATH, arch));
                                                                if (fs.existsSync(pathDescarga)) {
                                                                    filedescarga = arch;
                                                                    banderaDescargaxlsx = fs.existsSync(pathDescarga);
                                                                }
                                                            });

                                                            //const pathDescarga = path.normalize(path.join(process.env.DOWNLOAD_PATH, process.env.FILE_DESCARGA));

                                                            contDescarga++;
                                                            await sleep(500);
                                                        } while (!banderaDescargaxlsx && contDescarga < 12);
                                                        if (banderaDescargaxlsx) {
                                                            console.log('Archivo descargado');
                                                            logger.info('Archivo descargado');
                                                            fs.renameSync(path.join(process.env.DOWNLOAD_PATH, filedescarga), path.join(process.env.DOWNLOAD_PATH, taskarray[contadorTareas] + process.env.EXTENSION));
                                                            console.log('Archivo renombrado');
                                                            logger.info('Archivo renombrado');
                                                            contadordescargas++;
                                                        }
                                                        descargados.push(banderaDescargaxlsx);
                                                    } else {
                                                        console.log('No se encotró iframe, se omite');
                                                        logger.info('No se encotró iframe, se omite');
                                                        descargados.push(false);
                                                    }
                                                } catch (error) {
                                                    console.log('Ha ocurrido un error: ' + error + '\nSe omite descarga');
                                                    logger.info('Ha ocurrido un error: ' + error + '\nSe omite descarga');
                                                    descargados.push(false);
                                                }
                                            }
                                        } else {
                                            console.log('Se omite tarea errónea o que no es de prueba.');
                                            logger.info('Se omite tarea errónea o que no es de prueba.');
                                            descargados.push(false);
                                        }
                                        contadorTareas++;
                                    }
                                }
                            } else {
                                for (let j = longitudReal - 1; j >= longitudReal - (blockSize + longerror); j--) {
                                    // console.log(j)
                                    await page.waitForSelector("table[id='wlctdc:j_id__ctru10:r1:0:tldc:taskTable:" + j + ":pgdjl1'] > tbody > tr > td > span");

                                    //Por cada elemento, recuperamos el titulo
                                    let data = await page.evaluate((j) => {
                                        const spans = Array.from(document.querySelectorAll("table[id='wlctdc:j_id__ctru10:r1:0:tldc:taskTable:" + j + ":pgdjl1'] > tbody > tr > td > span"));
                                        return spans.map((span) => span.innerText);
                                    }, j);
                                    data[0] = data[0].replace('Validate Rates Load ', '').replace('Validates Load of Rates ', '').replace('Validar carga de tarifas ', '').replace('Validar Carga de Tarifas ', '');
                                    taskarray.push(data[0]);
                                    console.log('Tarea localizada: ' + data[0]);
                                    logger.info('Tarea localizada: ' + data[0]);
                                    await page.click("table[id='wlctdc:j_id__ctru10:r1:0:tldc:taskTable:" + j + ":pgdjl1']");
                                    //await page.evaluate(b => b.click("table[id='wlctdc:j_id__ctru10:r1:0:tldc:taskTable:" + j + ":pgdjl1']"));
                                }
                                await sleep(4000);
                                //Por cada tarea detectada, seleccionamos el recuadro correspondiente
                                //let i = t-1; i > (t-1)-blockSize; i--
                                let contadorTareas = 0;
                                for (let i = longitudReal - 1; i >= longitudReal - (blockSize + longerror); i--) {
                                    if (!tareasError.includes(taskarray[contadorTareas])) {
                                        await page.waitForSelector("table[id='wlctdc:j_id__ctru10:r1:0:tldc:taskTable:" + i + ":pgdjl1'] ");
                                        await page.click("table[id='wlctdc:j_id__ctru10:r1:0:tldc:taskTable:" + i + ":pgdjl1']");
                                        await sleep(5500);
                                        let rutaarchivo = path.join(process.env.DOWNLOAD_PATH, taskarray[contadorTareas] + process.env.EXTENSION);
                                        {
                                            console.log('Nuevo archivo para descargar');
                                            logger.info('Nuevo archivo para descargar');
                                            await sleep(5500);
                                            try {
                                                //Cambiamos al frame donde aparece el botón de descarga
                                                let iframe = await funciones.cambiarFrameDescargaDocumento(page);
                                                let filedescarga;
                                                if (iframe) {
                                                    let banderaDescargaxlsx = false;
                                                    let contDescarga = 0;
                                                    do {
                                                        //Se le da click al botón de descarga
                                                        if (contDescarga == 0) {
                                                            try {
                                                                console.log('USANDO SELECTOR POR DEFECTO');
                                                                logger.info('USANDO SELECTOR POR DEFECTO');
                                                                await iframe.waitForSelector("div[id='pt1:r1:0:pt1:r1:0:bRS_BD']", { timeout: 15000 });
                                                                await iframe.click("img[id='pt1:r1:0:pt1:r1:0:bRS_BD::icon']");
                                                            } catch (error) {
                                                                console.log('USANDO SELECTOR ALTERNO');
                                                                logger.info('USANDO SELECTOR ALTERNO');
                                                                try {
                                                                    await iframe.waitForSelector("div[id='pt1:r1:0:ptVRL:r2:0:bBD']", { timeout: 300000 });
                                                                    //await iframe.click("img[id='pt1:r1:0:ptVRL:r2:0:bBD::icon']");
                                                                    await iframe.click("div[id='pt1:r1:0:ptVRL:r2:0:bBD']");
                                                                } catch (error) {
                                                                    console.log('No se pudo descargar archivo, selector desconocido');
                                                                    logger.info('No se pudo descargar archivo, selector desconocido');
                                                                }
                                                            }
                                                        }
                                                        //Verificamos si el archivo ya se descargó

                                                        let pathDescarga;
                                                        await sleep(5500);
                                                        let arreglodesc = process.env.FILE_DESCARGA.split('|');

                                                        arreglodesc.forEach((arch) => {
                                                            pathDescarga = path.normalize(path.join(process.env.DOWNLOAD_PATH, arch));
                                                            if (fs.existsSync(pathDescarga)) {
                                                                filedescarga = arch;
                                                                banderaDescargaxlsx = fs.existsSync(pathDescarga);
                                                            }
                                                        });

                                                        //const pathDescarga = path.normalize(path.join(process.env.DOWNLOAD_PATH, process.env.FILE_DESCARGA));

                                                        contDescarga++;
                                                        await sleep(500);
                                                    } while (!banderaDescargaxlsx && contDescarga < 12);
                                                    if (banderaDescargaxlsx) {
                                                        console.log('Archivo descargado');
                                                        logger.info('Archivo descargado');
                                                        fs.renameSync(path.join(process.env.DOWNLOAD_PATH, filedescarga), path.join(process.env.DOWNLOAD_PATH, taskarray[contadorTareas] + process.env.EXTENSION));
                                                        console.log('Archivo renombrado');
                                                        logger.info('Archivo renombrado');
                                                        contadordescargas++;
                                                    }
                                                    descargados.push(banderaDescargaxlsx);
                                                } else {
                                                    console.log('No se encotró iframe, se omite');
                                                    logger.info('No se encotró iframe, se omite');
                                                    descargados.push(false);
                                                }
                                            } catch (error) {
                                                console.log('Ha ocurrido un error: ' + error + '\nSe omite descarga');
                                                logger.info('Ha ocurrido un error: ' + error + '\nSe omite descarga');
                                                descargados.push(false);
                                            }
                                        }
                                    } else {
                                        console.log('Se omite tarea errónea o que no es de prueba.');
                                        logger.info('Se omite tarea errónea o que no es de prueba.');
                                        descargados.push(false);
                                    }
                                    contadorTareas++;
                                }
                            }

                            console.log('Se descargaron: ' + contadordescargas + ' archivo(s)');
                            logger.info('Se descargaron: ' + contadordescargas + ' archivo(s)');

                            //Logout
                            await page.waitForSelector("div[id='wlctdc:wlhtdc:j_id__ctru8:usrD1'] > div", { timeout: 300000 });
                            await page.click("div[id='wlctdc:wlhtdc:j_id__ctru8:usrD1'] > div");

                            await page.waitForSelector("tr[id='wlctdc:wlhtdc:j_id__ctru8:j_id__ctru12pc2'] > td.x19c", { timeout: 300000 });
                            await page.click("tr[id='wlctdc:wlhtdc:j_id__ctru8:j_id__ctru12pc2'] > td.x19c");
                            await sleep(2500);
                            await browser.close();

                            let strtareas = 'Buen día, se procesarán las siguientes tareas de DAT\n';
                            let countrTareasCorrectas = 0;
                            for (let index = 0; index < taskarray.length; index++) {
                                if (!tareasError.includes(taskarray[index])) {
                                    strtareas = strtareas + taskarray[index] + '\n';
                                    countrTareasCorrectas++;
                                }
                            }
                            if (countrTareasCorrectas != 0) {
                                await funciones.notificaInicio(strtareas);
                            }

                            for (let index = 0; index < taskarray.length; index++) {
                                if (descargados[index]) {
                                    console.log('PROCESANDO TAREA ' + taskarray[index]);
                                    logger.info('PROCESANDO TAREA ' + taskarray[index]);
                                    let OBJestatus = await funciones.procesoGeneracionLeyendas(taskarray[index]);
                                    //PRUEBAS POS QUIT TARIFAS MONTO Y PISO
                                    //let v4prueba = await V4funciones.procesoGeneracionLeyendas(taskarray[index]);
                                    //console.log('Prueba GDL alterno', v4prueba);
                                    //logger.info('Prueba GDL alterno', v4prueba);
                                    correctos.push(OBJestatus.resultado);
                                    archivos.push(OBJestatus.archivo);
                                    observacionesGDL.push(OBJestatus.bodyGDL);
                                    numLeyendas.push(OBJestatus.numleyendas);
                                    contratos.push(OBJestatus.contrato);
                                    cuentas.push(OBJestatus.cuenta);
                                    numsols.push(OBJestatus.numsol);
                                    totalleyendas = totalleyendas + OBJestatus.numleyendas;
                                } else {
                                    console.log('SE OMITE TAREA: ' + taskarray[index] + ', NO SE PUDO DESCARGAR EL ARCHIVO');
                                    correctos.push(false);
                                    archivos.push('');
                                    observacionesGDL.push('El archivo de la tarea ' + taskarray[index] + ' no pudo ser descargado.');
                                    numLeyendas.push(0);
                                    contratos.push('');
                                    cuentas.push('');
                                    numsols.push('');
                                }

                                console.log('PROCESADAS ' + (index + 1) + ' TAREAS DE ' + taskarray.length);
                                logger.info('PROCESADAS ' + (index + 1) + ' TAREAS DE ' + taskarray.length);
                                await sleep(4000); //Se añade sleep para esperar a que el archivo se genere
                            }

                            console.log('SE HAN PROCESADO LAS TAREAS CON ARCHIVOS DESCARGADOS DEL DAT');
                            console.log(correctos);
                            logger.info('SE HAN PROCESADO LAS TAREAS CON ARCHIVOS DESCARGADOS DEL DAT');
                            logger.info(correctos);

                            console.log('Comenzando proceso de carga a Plataforma HMP');
                            logger.info('Comenzando proceso de carga a Plataforma HMP');
                            //Carga HMP
                            let statusHMP = await funciones.cargaHMP(correctos, archivos, numLeyendas);
                            console.log('Comenzando proceso de liberación DAT');
                            logger.info('Comenzando proceso de liberación DAT');
                            //Proceso liberación DAT

                            //Login
                            browser = await puppeteer.launch({ headless: true});
                            //browser = await puppeteer.launch({ headless: false });
                            page = await browser.newPage();
                            await page.setExtraHTTPHeaders({
                                'Accept-Language': 'es',
                            });
                            await page.goto(process.env.DAT_URL, { waitUntil: 'networkidle2' });

                            await page.waitForSelector("input[name='j_username']");
                            await page.type("input[name='j_username']", process.env.USERCONVENIOS, { delay: 100 });
                            await page.waitForSelector("input[name='j_password']");
                            await page.type("input[name='j_password']", process.env.PASSCONVENIOS, { delay: 100 });
                            await page.click('#loginButton');
                            //Espera y cuenta de tareas en plataforma
                            await sleep(15000);

                            urlFail = await page.url();
                            while (urlFail == process.env.DAT_FAIL) {
                                console.log('Reintentando Login!');
                                logger.info('Reintentando Login!');
                                await page.waitForSelector("input[id='j_username::content']");
                                await page.type("input[id='j_username::content']", process.env.USERCONVENIOS, { delay: 100 });
                                await page.waitForSelector("input[id='j_password::content']");
                                await page.type("input[id='j_password::content']", process.env.PASSCONVENIOS, { delay: 100 });
                                await page.click('#loginButton');

                                await sleep(15000);
                                urlFail = await page.url();
                            }

                            //Columna asignado

                            await page.waitForSelector("th[id='wlctdc:j_id__ctru10:r1:0:tldc:taskTable:crhj1j_id_2'] > div.x1ko > span", { timeout: 0 }); // original: { timeout: 300000 }
                            await page.click("th[id='wlctdc:j_id__ctru10:r1:0:tldc:taskTable:crhj1j_id_2'] > div.x1ko > span");
                            //Flecha ordenar ascendente
                            await page.waitForSelector("table[id='wlctdc:j_id__ctru10:r1:0:tldc:taskTable:crhj1j_id_2::afrSI'] > tbody > tr > td:nth-child(1) > a", { timeout: 300000 });
                            await page.click("table[id='wlctdc:j_id__ctru10:r1:0:tldc:taskTable:crhj1j_id_2::afrSI'] > tbody > tr > td:nth-child(1) > a");

                            let t2 = (await page.$$("div[id='wlctdc:j_id__ctru10:r1:0:tldc:taskTable::db'] > table > tbody > tr")).length;
                            let longitudReal2 = await page.evaluate(() => document.querySelector("div[id='wlctdc:j_id__ctru10:r1:0:tldc:taskTable::db'] > table:nth-child(1)").getAttribute('_rowcount'));
                            if (t2 > 0) {
                                if (longitudReal2 > 20) {
                                    if (longitudReal2 > 23 + longerror + 1) {
                                        for (let j = t2; j < t2 + (blockSize + longerror); j++) {
                                            await page.waitForSelector("table[id='wlctdc:j_id__ctru10:r1:0:tldc:taskTable:" + j + ":pgdjl1'] > tbody > tr > td > span");

                                            //Por cada elemento, recuperamos el titulo
                                            let data = await page.evaluate((j) => {
                                                const spans = Array.from(document.querySelectorAll("table[id='wlctdc:j_id__ctru10:r1:0:tldc:taskTable:" + j + ":pgdjl1'] > tbody > tr > td > span"));
                                                return spans.map((span) => span.innerText);
                                            }, j);
                                            data[0] = data[0].replace('Validate Rates Load ', '').replace('Validates Load of Rates ', '').replace('Validar carga de tarifas ', '').replace('Validar Carga de Tarifas ', '');
                                            taskarray2.push(data[0]);
                                            console.log('Tarea localizada: ' + data[0]);
                                            logger.info('Tarea localizada: ' + data[0]);
                                            await page.click("table[id='wlctdc:j_id__ctru10:r1:0:tldc:taskTable:" + j + ":pgdjl1']");
                                        }
                                        await sleep(4000);
                                        let contadorTareas2 = 0;
                                        for (let i = t2; i < t2 + (blockSize + longerror); i++) {
                                            //LIBERACION 1
                                            //Si es de las tareas detectadas al principio
                                            if (taskarray.includes(taskarray2[contadorTareas2])) {
                                                console.log('Se prepara para liberación tarea: ' + taskarray2[contadorTareas2]);
                                                logger.info('Se prepara para liberación tarea: ' + taskarray2[contadorTareas2]);
                                                // LIBERACION, VALIDACION Y REINTENTO
                                                validar = 0;
                                                intento = 0;
                                                tareaLiberada = 0;
                                                //primer liberacion
                                                while (intento < 3) {
                                                    if (validar == 0) {
                                                        console.log('Intento de liberación VER 1: ' + intento);
                                                        logger.info('Intento de liberación VER 1: ' + intento);
                                                        await page.waitForSelector("table[id='wlctdc:j_id__ctru10:r1:0:tldc:taskTable:" + i + ":pgdjl1'] ", { timeout: 30000 });
                                                        await page.click("table[id='wlctdc:j_id__ctru10:r1:0:tldc:taskTable:" + i + ":pgdjl1']");
                                                        await sleep(5000);
                                                        let indexcorrecto = taskarray.indexOf(taskarray2[contadorTareas2]);
                                                        let objHMP = statusHMP[indexcorrecto];
                                                        ///primer try
                                                        try {
                                                            //Cambiamos al frame donde aparece el botón de liberación
                                                            let iframe = await funciones.cambiarFrameDescargaDocumento(page);
                                                            if (correctos[indexcorrecto] && objHMP.statusCargado) {
                                                                console.log('Entrando a proceso de liberación');
                                                                logger.info('Entrando a proceso de liberación');
                                                                await sleep(5000);
                                                                //Ingreso de comentario "Se libera carga"
                                                                try {
                                                                    await iframe.waitForSelector("input[id='pt1:r1:0:pt1:pt_r2r:0:pc1:t2:0:it1::content']", { timeout: 18000 });
                                                                    await iframe.type("input[id='pt1:r1:0:pt1:pt_r2r:0:pc1:t2:0:it1::content']", process.env.STRING_CONFIRMA, { delay: 100 });
                                                                } catch (error) {
                                                                    try {
                                                                        console.log('No se encontró input, se prueba con Textarea');
                                                                        logger.info('No se encontró input, se prueba con Textarea');
                                                                        await iframe.waitForSelector("textarea[id='pt1:r1:0:ptVRL:pt_r2:0:pc1:t1:0:it3::content']", { timeout: 18000 });
                                                                        await iframe.type("textarea[id='pt1:r1:0:ptVRL:pt_r2:0:pc1:t1:0:it3::content']", process.env.STRING_CONFIRMA, { delay: 100 });
                                                                    } catch (error) {
                                                                        console.log('No se encontro ningun elemento para ingresar el comentario');
                                                                        logger.info('No se encontro ningun elemento para ingresar el comentario');
                                                                        intento++;
                                                                    }
                                                                }
                                                                //Validando frame, tarea es la misma que el nombre que aparece en el iframe
                                                                try {
                                                                    await iframe.waitForSelector("td[id ='pt1:ph1::_afrTtxt'] > div > h1 ", { timeout: 18000 });
                                                                    //console.log('paso el wait')
                                                                    let tareaFrame = await iframe.$eval("td[id ='pt1:ph1::_afrTtxt'] > div > h1 ", (el) => el.innerHTML);
                                                                    //tareaFrame = tareaFrame.replace('Validar Carga de Tarifas ', '')
                                                                    tareaFrame = tareaFrame.replace('Validate Rates Load ', '').replace('Validates Load of Rates ', '').replace('Validar carga de tarifas ', '').replace('Validar Carga de Tarifas ', '');
                                                                    tareaFrame = tareaFrame.trim();
                                                                    tareaFrame = tareaFrame.replace(/\s+/g, '');
                                                                    let tareaProcesa = taskarray2[contadorTareas2].replace(/\s+/g, '');
                                                                    //console.log('-'+name+'-')
                                                                    console.log('Tarea a procesar -' + tareaProcesa + '-' + 'Tarea en frame -' + tareaFrame + '-');
                                                                    logger.info('Tarea a procesar -' + tareaProcesa + '-' + 'Tarea en frame -' + tareaFrame + '-');
                                                                    //Valida tarea con FRAME
                                                                    if (tareaFrame == tareaProcesa) {
                                                                        console.log('Es el mismo proceso a liberar');
                                                                        logger.info('Es el mismo proceso a liberar');
                                                                        try {
                                                                            //Se libera la tarea del DAT
                                                                            await iframe.waitForSelector(" div[id='pt1:b1'] > a", { timeout: 300000 });
                                                                            await iframe.click(" div[id='pt1:b1'] > a");
                                                                            await sleep(5000);
                                                                            contadorliberados++;
                                                                            validar = 1;
                                                                            console.log('Se ha liberado una tarea de DAT(proceso boton');
                                                                            logger.info('Se ha liberado una tarea de DAT(proceso boton');
                                                                            intento = 3;
                                                                            tareaLiberada = 1;
                                                                        } catch (Error) {
                                                                            //No pudo liberar la tarea
                                                                            console.log('No pudo realizar la liberacion de la tarea(boton)');
                                                                            logger.info('No pudo realizar la liberacion de la tarea(boton)');
                                                                            tareaLiberada = 0;
                                                                            validar = 0;
                                                                            intento++;
                                                                        }
                                                                    } else {
                                                                        console.log('No es la misma tarea');
                                                                        logger.info('No es la misma tarea');
                                                                        intento++;
                                                                        //funciones.alertaErrorLiberar(taskarray2[contadorTareas2])
                                                                    }
                                                                } catch (error) {
                                                                    console.log('Error en la validación de frame y  liberación ' + error);
                                                                    logger.info('Error en la validación de frame y  liberación ' + error);
                                                                    //funciones.alertaErrorLiberar(taskarray2[contadorTareas2])
                                                                    intento++;
                                                                }
                                                            } else {
                                                                console.log('Se omite tarea para liberar, no ha sido correcta su carga a HMP o generación de leyenda');
                                                                logger.info('Se omite tarea para liberar, no ha sido correcta su carga a HMP o generación de leyenda');
                                                                intento = 3;
                                                            }
                                                            logger.info('datos de validacion: ', intento, validar, tareaLiberada)
                                                            console.log('datos de validacion: ', intento, validar, tareaLiberada)

                                                            ///fuera del segundo try
                                                            if (intento == 3) {
                                                                console.log('termino ciclo de liberacion');
                                                                logger.info('termino ciclo de liberacion');
                                                                //Se actualiza o se registra la tarea en BD
                                                                let stringmailbd = observacionesGDL[indexcorrecto] + '\n' + objHMP.desc;
                                                                if (await funcionesBD.checkifExistsTareaDat(taskarray2[contadorTareas2])) {
                                                                    await funcionesBD.actualizaProcesoTerminadoDAT(taskarray2[contadorTareas2], numLeyendas[indexcorrecto], await funcionesBD.generaFechaSQL(), objHMP.statusCargado, stringmailbd);
                                                                    console.log('Archivo en BD Actualizado');
                                                                    logger.info('Archivo en BD Actualizado');
                                                                } else {
                                                                    await funcionesBD.insertaProcesoTerminadoDAT(taskarray2[contadorTareas2], numLeyendas[indexcorrecto], await funcionesBD.generaFechaSQL(), objHMP.statusCargado, stringmailbd);
                                                                    console.log('Archivo en BD insertado');
                                                                    logger.info('Archivo en BD insertado');
                                                                    console.log('datos en insert',  taskarray2[contadorTareas2], numLeyendas[indexcorrecto], await funcionesBD.generaFechaSQL(), objHMP.statusCargado, stringmailbd );
                                                                    logger.info('datos en insert', taskarray2[contadorTareas2], numLeyendas[indexcorrecto], await funcionesBD.generaFechaSQL(), objHMP.statusCargado, stringmailbd );
                                                                    
                                                                }

                                                                //En caso de que el archivo haya sido erroneo
                                                                if (await funcionesBD.checkifExistsTareaError(taskarray2[contadorTareas2])) {
                                                                    if (objHMP.statusCargado) {
                                                                        await funcionesBD.eliminaTareaError(taskarray2[contadorTareas2]);
                                                                        console.log('Se elimina de tareas en espera');
                                                                        logger.info('Se elimina de tareas en espera');
                                                                        //Se envia correo de estatus de la tarea no pudo liberarla
                                                                        if (tareaLiberada == 1 && validar == 1) {
                                                                            //Se envia correo de status de la tarea.
                                                                            let stringmail = observacionesGDL[indexcorrecto] + '\n' + objHMP.desc;
                                                                            await funciones.enviaCorreo(stringmail, cuentas[indexcorrecto], numsols[indexcorrecto]);
                                                                            console.log('correo de libero');
                                                                            logger.info('correo de libero');
                                                                        } else {
                                                                            //Se envia correo correo de no liberado
                                                                            let stringmail = observacionesGDL[indexcorrecto] + '\n' + objHMP.desc;
                                                                            await funciones.alertaErrorLiberar(taskarray2[contadorTareas2], stringmail);
                                                                            console.log('No se pudo liberar la tarea, en la próxima iteración se reintentara');
                                                                            logger.info('No se pudo liberar la tarea, en la próxima iteración se reintentara');
                                                                        }
                                                                    } else {
                                                                        let actionError = await funcionesBD.consultaUltimoIntentoDAT(taskarray2[contadorTareas2]);
                                                                        if (actionError == 'WAIT') {
                                                                            console.log('Tarea en espera, no se ha procesado todavía, esperar 24h');
                                                                            logger.info('Tarea en espera, no se ha procesado todavía, esperar 24h');
                                                                        } else {
                                                                            let iderror = await funcionesBD.consigueIDTareaError(taskarray2[contadorTareas2]);
                                                                            await funcionesBD.actualizaTareaError(iderror, await funcionesBD.generaFechaSQL());
                                                                            console.log('Archivo procesado con error nuevamente, se espera a próximo día');
                                                                            logger.info('Archivo procesado con error nuevamente, se espera a próximo día');
                                                                            let stringmail = observacionesGDL[indexcorrecto] + '\n' + objHMP.desc;
                                                                            await funciones.enviaCorreo(stringmail, cuentas[indexcorrecto], numsols[indexcorrecto]);
                                                                        }
                                                                    }
                                                                } else {
                                                                    if (objHMP.statusCargado && tareaLiberada == 0 && validar == 0) {
                                                                        //no se pudo liberar
                                                                        let stringmail = observacionesGDL[indexcorrecto] + '\n' + objHMP.desc;
                                                                        await funciones.alertaErrorLiberar(taskarray2[contadorTareas2], stringmail);
                                                                        console.log(' Tarea error en la liberación, en la próxima iteración se volvera a intentar');
                                                                        logger.info(' Tarea error en la liberación, en la próxima iteración se volvera a intentar');
                                                                    } else {
                                                                        if (!objHMP.statusCargado) {
                                                                            if (objHMP.desc != 'Ocurrió un error con la plataforma HMP') {
                                                                                await funcionesBD.insertaTareaErroneo(taskarray2[contadorTareas2], await funcionesBD.generaFechaSQL());
                                                                                console.log('Se inserta en tareas erróneas');
                                                                                logger.info('Se inserta en tareas erróneas');
                                                                            } else {
                                                                                console.log('Se retoma para próxima iteración el archivo');
                                                                                logger.info('Se retoma para próxima iteración el archivo');
                                                                            }
                                                                        }
                                                                        //Se envia correo de estatus de la tare
                                                                        let stringmail = observacionesGDL[indexcorrecto] + '\n' + objHMP.desc;
                                                                        let envio =await funciones.enviaCorreo(stringmail, cuentas[indexcorrecto], numsols[indexcorrecto]);
                                                                        if(!envio){
                                                                            console.log('reintento de envio correo ')
                                                                            await funciones.enviaCorreo(stringmail, cuentas[indexcorrecto], numsols[indexcorrecto]);
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        } catch (error) {
                                                            console.log('Errror desde cambio a frame ' + error);
                                                            logger.info('Error desde cambio a frame ' + error);
                                                        }
                                                    } else {
                                                        console.log('Ya se valido  o termino intentos');
                                                        logger.info('Ya se valido  o termino intentos');
                                                    }
                                                }
                                            } else {
                                                console.log('Se omite tarea ' + taskarray2[contadorTareas2] + ', aún no se ha descargado archivo de tarifas y suplementos');
                                                logger.info('Se omite tarea ' + taskarray2[contadorTareas2] + ', aún no se ha descargado archivo de tarifas y suplementos');
                                            }
                                            contadorTareas2++;
                                        }
                                    } else {
                                        for (let j = longitudReal2 - 1; j > longitudReal2 - 1 - (blockSize + longerror); j--) {
                                            //LIBERACION 2
                                            await page.waitForSelector("table[id='wlctdc:j_id__ctru10:r1:0:tldc:taskTable:" + j + ":pgdjl1'] > tbody > tr > td > span");

                                            //Por cada elemento, recuperamos el titulo
                                            let data = await page.evaluate((j) => {
                                                const spans = Array.from(document.querySelectorAll("table[id='wlctdc:j_id__ctru10:r1:0:tldc:taskTable:" + j + ":pgdjl1'] > tbody > tr > td > span"));
                                                return spans.map((span) => span.innerText);
                                            }, j);
                                            data[0] = data[0].replace('Validate Rates Load ', '').replace('Validates Load of Rates ', '').replace('Validar carga de tarifas ', '').replace('Validar Carga de Tarifas ', '');
                                            taskarray2.push(data[0]);
                                            console.log('Tarea localizada: ' + data[0]);
                                            logger.info('Tarea localizada: ' + data[0]);
                                            await page.click("table[id='wlctdc:j_id__ctru10:r1:0:tldc:taskTable:" + j + ":pgdjl1']");
                                        }
                                        await sleep(4000);
                                        let contadorTareas2 = 0;
                                        for (let i = longitudReal2 - 1; i > longitudReal2 - 1 - (blockSize + longerror); i--) {
                                            //Si es de las tareas detectadas al principio
                                            if (taskarray.includes(taskarray2[contadorTareas2])) {
                                                console.log('Se prepara para liberación tarea: ' + taskarray2[contadorTareas2]);
                                                logger.info('Se prepara para liberación tarea: ' + taskarray2[contadorTareas2]);
                                                // LIBERACION, VALIDACION Y REINTENTO
                                                validar = 0;
                                                intento = 0;
                                                tareaLiberada = 0;
                                                while (intento < 3) {
                                                    if (validar == 0) {
                                                        console.log('Intento de liberación VER 2: ' + intento);
                                                        logger.info('Intento de liberación VER 2: ' + intento);
                                                        await page.waitForSelector("table[id='wlctdc:j_id__ctru10:r1:0:tldc:taskTable:" + i + ":pgdjl1'] ", { timeout: 30000 });
                                                        await page.click("table[id='wlctdc:j_id__ctru10:r1:0:tldc:taskTable:" + i + ":pgdjl1']");
                                                        await sleep(5000);
                                                        let indexcorrecto = taskarray.indexOf(taskarray2[contadorTareas2]);
                                                        let objHMP = statusHMP[indexcorrecto];
                                                        //primer try
                                                        try {
                                                            //Cambiamos al frame donde aparece el botón de liberación
                                                            let iframe = await funciones.cambiarFrameDescargaDocumento(page);
                                                            if (correctos[indexcorrecto] && objHMP.statusCargado) {
                                                                console.log('Entrando a proceso de liberación');
                                                                logger.info('Entrando a proceso de liberación');
                                                                await sleep(5000);
                                                                //Ingreso de comentario "Se libera carga"
                                                                try {
                                                                    await iframe.waitForSelector("input[id='pt1:r1:0:pt1:pt_r2r:0:pc1:t2:0:it1::content']", { timeout: 18000 });
                                                                    await iframe.type("input[id='pt1:r1:0:pt1:pt_r2r:0:pc1:t2:0:it1::content']", process.env.STRING_CONFIRMA, { delay: 100 });
                                                                } catch (error) {
                                                                    try {
                                                                        console.log('No se encontró input, se prueba con Textarea');
                                                                        logger.info('No se encontró input, se prueba con Textarea');
                                                                        await iframe.waitForSelector("textarea[id='pt1:r1:0:ptVRL:pt_r2:0:pc1:t1:0:it3::content']", { timeout: 18000 });
                                                                        await iframe.type("textarea[id='pt1:r1:0:ptVRL:pt_r2:0:pc1:t1:0:it3::content']", process.env.STRING_CONFIRMA, { delay: 100 });
                                                                    } catch (error) {
                                                                        console.log('No se encontro elemento para ingresar el comentario de liberación');
                                                                        logger.info('No se encontro elemento para ingresar el comentario de liberación');
                                                                        intento++;
                                                                    }
                                                                }
                                                                //Validando frame, tarea es la misma que el nombre que aparece en el iframe
                                                                try {
                                                                    await iframe.waitForSelector("td[id ='pt1:ph1::_afrTtxt'] > div > h1 ", { timeout: 18000 });
                                                                    //console.log('paso el wait')
                                                                    let tareaFrame = await iframe.$eval("td[id ='pt1:ph1::_afrTtxt'] > div > h1 ", (el) => el.innerHTML);
                                                                    //tareaFrame = tareaFrame.replace('Validar Carga de Tarifas ', '')
                                                                    tareaFrame = tareaFrame.replace('Validate Rates Load ', '').replace('Validates Load of Rates ', '').replace('Validar carga de tarifas ', '').replace('Validar Carga de Tarifas ', '');
                                                                    tareaFrame = tareaFrame.trim();
                                                                    tareaFrame = tareaFrame.replace(/\s+/g, '');
                                                                    let tareaProcesa = taskarray2[contadorTareas2].replace(/\s+/g, '');
                                                                    //console.log('-'+name+'-')
                                                                    console.log('Tarea a procesar -' + tareaProcesa + '-' + 'Tarea en frame -' + tareaFrame + '-');
                                                                    logger.info('Tarea a procesar -' + tareaProcesa + '-' + 'Tarea en frame -' + tareaFrame + '-');
                                                                    //Valida tarea con FRAME
                                                                    if (tareaFrame == tareaProcesa) {
                                                                        console.log('Es el mismo proceso a liberar');
                                                                        logger.info('Es el mismo proceso a liberar');
                                                                        try {
                                                                            //Se libera la tarea del DAT
                                                                            validar = 1;
                                                                            await iframe.waitForSelector(" div[id='pt1:b1'] > a", { timeout: 300000 });
                                                                            await iframe.click(" div[id='pt1:b1'] > a");
                                                                            await sleep(5000);
                                                                            contadorliberados++;
                                                                            tareaLiberada = 1;
                                                                            console.log('Se ha liberado una tarea de DAT');
                                                                            logger.info('Se ha liberado una tarea de DAT');
                                                                            intento = 3;
                                                                        } catch (error) {
                                                                            console.log('No se pudo realizar la liberacion ' + error);
                                                                            logger.info('No se pudo realizar la liberacion ' + error);
                                                                            intento++;
                                                                            tareaLiberada = 0;
                                                                        }
                                                                    } else {
                                                                        console.log('No es la misma tarea');
                                                                        logger.info('No es la misma tarea');
                                                                        intento++;
                                                                        tareaLiberada = 0;
                                                                        validar = 0;
                                                                        //funciones.alertaErrorLiberar(taskarray2[contadorTareas2])
                                                                    }
                                                                } catch (error) {
                                                                    console.log('Error en la validación de frame y  liberación ' + error);
                                                                    logger.info('Error en la validación de frame y  liberación ' + error);
                                                                    //funciones.alertaErrorLiberar(taskarray2[contadorTareas2])
                                                                    intento++;
                                                                }
                                                            } else {
                                                                console.log('Se omite tarea para liberar, no ha sido correcta su carga a HMP o generación de leyenda');
                                                                logger.info('Se omite tarea para liberar, no ha sido correcta su carga a HMP o generación de leyenda');
                                                                intento = 3;
                                                                tareaLiberada = 0;
                                                            }
                                                            logger.info('datos de validacion: ', intento, validar, tareaLiberada)
                                                            console.log('datos de validacion: ', intento, validar, tareaLiberada)
                                                            if (intento == 3) {
                                                                console.log('termino ciclo de liberacion');
                                                                logger.info('termino ciclo de liberacion');
                                                                console.log('validación de intento valor 3');
                                                                //Se actualiza o se registra la tarea en BD
                                                                let stringmailbd = observacionesGDL[indexcorrecto] + '\n' + objHMP.desc;
                                                                if (await funcionesBD.checkifExistsTareaDat(taskarray2[contadorTareas2])) {
                                                                    await funcionesBD.actualizaProcesoTerminadoDAT(taskarray2[contadorTareas2], numLeyendas[indexcorrecto], await funcionesBD.generaFechaSQL(), objHMP.statusCargado, stringmailbd);
                                                                    console.log('Archivo en BD Actualizado');
                                                                    logger.info('Archivo en BD Actualizado');
                                                                } else {
                                                                    await funcionesBD.insertaProcesoTerminadoDAT(taskarray2[contadorTareas2], numLeyendas[indexcorrecto], await funcionesBD.generaFechaSQL(), objHMP.statusCargado, stringmailbd);
                                                                    console.log('Archivo en BD insertado');
                                                                    logger.info('Archivo en BD insertado');
                                                                    console.log('datos en insert',  taskarray2[contadorTareas2], numLeyendas[indexcorrecto], await funcionesBD.generaFechaSQL(), objHMP.statusCargado, stringmailbd );
                                                                    logger.info('datos en insert', taskarray2[contadorTareas2], numLeyendas[indexcorrecto], await funcionesBD.generaFechaSQL(), objHMP.statusCargado, stringmailbd );
                                                                }
                                                                //En caso de que el archivo haya sido erroneo
                                                                if (await funcionesBD.checkifExistsTareaError(taskarray2[contadorTareas2])) {
                                                                    console.log('STATUS CARGADO HMP',objHMP.statusCargado)
                                                                    logger.info('STATUS CARGADO HMP',objHMP.statusCargado)
                                                                    if (objHMP.statusCargado) {
                                                                        await funcionesBD.eliminaTareaError(taskarray2[contadorTareas2]);
                                                                        console.log('Se elimina de tareas en espera');
                                                                        logger.info('Se elimina de tareas en espera');
                                                                        //Se envia correo de estatus de la tarea
                                                                        if (tareaLiberada == 1 && validar == 1) {
                                                                            //se libero datos
                                                                            let stringmail = observacionesGDL[indexcorrecto] + '\n' + objHMP.desc;
                                                                            await funciones.enviaCorreo(stringmail, cuentas[indexcorrecto], numsols[indexcorrecto]);
                                                                            console.log('correo libero');
                                                                            logger.info('correo libero');
                                                                        } else {
                                                                            //no se pudo liberar
                                                                            let stringmail = observacionesGDL[indexcorrecto] + '\n' + objHMP.desc;
                                                                            await funciones.alertaErrorLiberar(taskarray2[contadorTareas2], stringmail);
                                                                            console.log('correo  no libero, en la próxima iteración se volvera a intentar');
                                                                            logger.info('correo  no libero, en la próxima iteración se volvera a intentar');
                                                                        }
                                                                    } else {
                                                                        let actionError = await funcionesBD.consultaUltimoIntentoDAT(taskarray2[contadorTareas2]);
                                                                        if (actionError == 'WAIT') {
                                                                            console.log('Tarea en espera, no se ha procesado todavía, esperar 24h');
                                                                            logger.info('Tarea en espera, no se ha procesado todavía, esperar 24h');
                                                                        } else {
                                                                            let iderror = await funcionesBD.consigueIDTareaError(taskarray2[contadorTareas2]);
                                                                            await funcionesBD.actualizaTareaError(iderror, await funcionesBD.generaFechaSQL());
                                                                            console.log('Archivo procesado con error nuevamente, se espera a próximo día');
                                                                            logger.info('Archivo procesado con error nuevamente, se espera a próximo día');
                                                                            let stringmail = observacionesGDL[indexcorrecto] + '\n' + objHMP.desc;
                                                                            await funciones.enviaCorreo(stringmail, cuentas[indexcorrecto], numsols[indexcorrecto]);
                                                                        }
                                                                    }
                                                                } else {
                                                                    if (objHMP.statusCargado && tareaLiberada == 0 && validar == 0) {
                                                                        //no se pudo liberar
                                                                        let stringmail = observacionesGDL[indexcorrecto] + '\n' + objHMP.desc;
                                                                        await funciones.alertaErrorLiberar(taskarray2[contadorTareas2], stringmail);
                                                                        console.log(' Tarea error en la liberación, en la próxima iteración se volvera a intentar');
                                                                        logger.info(' Tarea error en la liberación, en la próxima iteración se volvera a intentar');
                                                                    } else {
                                                                        if (!objHMP.statusCargado) {
                                                                            if (objHMP.desc != 'Ocurrió un error con la plataforma HMP') {
                                                                                await funcionesBD.insertaTareaErroneo(taskarray2[contadorTareas2], await funcionesBD.generaFechaSQL());
                                                                                console.log('Se inserta en tareas erróneas');
                                                                                logger.info('Se inserta en tareas erróneas');
                                                                            } else {
                                                                                console.log('Se retoma para próxima iteración el archivo');
                                                                                logger.info('Se retoma para próxima iteración el archivo');
                                                                            }
                                                                        }
                                                                        //Se envia correo de estatus de la tare
                                                                        let stringmail = observacionesGDL[indexcorrecto] + '\n' + objHMP.desc;
                                                                        let envio =await funciones.enviaCorreo(stringmail, cuentas[indexcorrecto], numsols[indexcorrecto]);
                                                                        if(!envio){
                                                                            console.log('reintento de envio correo ')
                                                                            await funciones.enviaCorreo(stringmail, cuentas[indexcorrecto], numsols[indexcorrecto]);
                                                                        }
                                                                        
                                                                        
                                                                    }
                                                                }
                                                            }
                                                        } catch (error) {
                                                            console.log('Error desde cambio a frame ' + error);
                                                            logger.info('Error desde cambio a frame ' + error);
                                                        }
                                                    } else {
                                                        console.log('Ya se valido  el frame y se libero');
                                                        logger.info('Ya se valido  el frame y se libero');
                                                    }
                                                }
                                            } else {
                                                console.log('Se omite tarea ' + taskarray2[contadorTareas2] + ', aún no se ha descargado archivo de tarifas y suplementos');
                                                logger.info('Se omite tarea ' + taskarray2[contadorTareas2] + ', aún no se ha descargado archivo de tarifas y suplementos');
                                            }
                                            contadorTareas2++;
                                        }
                                    }
                                } else {
                                    for (let j = longitudReal2 - 1; j >= longitudReal2 - (blockSize + longerror); j--) {
                                        await page.waitForSelector("table[id='wlctdc:j_id__ctru10:r1:0:tldc:taskTable:" + j + ":pgdjl1'] > tbody > tr > td > span");
                                        //LIBERACION 3
                                        //Por cada elemento, recuperamos el titulo
                                        let data = await page.evaluate((j) => {
                                            const spans = Array.from(document.querySelectorAll("table[id='wlctdc:j_id__ctru10:r1:0:tldc:taskTable:" + j + ":pgdjl1'] > tbody > tr > td > span"));
                                            return spans.map((span) => span.innerText);
                                        }, j);
                                        data[0] = data[0].replace('Validate Rates Load ', '').replace('Validates Load of Rates ', '').replace('Validar carga de tarifas ', '').replace('Validar Carga de Tarifas ', '');
                                        taskarray2.push(data[0]);
                                        console.log('Tarea localizada: ' + data[0]);
                                        logger.info('Tarea localizada: ' + data[0]);
                                        await page.click("table[id='wlctdc:j_id__ctru10:r1:0:tldc:taskTable:" + j + ":pgdjl1']",{ timeout: 18000 });
                                    }
                                    await sleep(4000);
                                    let contadorTareas2 = 0;
                                    for (let i = longitudReal2 - 1; i >= longitudReal2 - (blockSize + longerror); i--) {
                                        //Si es de las tareas detectadas al principio
                                        if (taskarray.includes(taskarray2[contadorTareas2])) {
                                            console.log('Se prepara para liberación tarea: ' + taskarray2[contadorTareas2]);
                                            logger.info('Se prepara para liberación tarea: ' + taskarray2[contadorTareas2]);
                                            // LIBERACION, VALIDACION Y REINTENTO
                                            validar = 0;
                                            intento = 0;
                                            tareaLiberada = 0;

                                            while (intento < 3) {
                                                if (validar == 0) {
                                                    console.log('Intento de liberación VER 3: ' + intento);
                                                    logger.info('Intento de liberación VER 3: ' + intento);
                                                    await page.waitForSelector("table[id='wlctdc:j_id__ctru10:r1:0:tldc:taskTable:" + i + ":pgdjl1'] ", { timeout: 30000 });
                                                    await page.click("table[id='wlctdc:j_id__ctru10:r1:0:tldc:taskTable:" + i + ":pgdjl1']");
                                                    await sleep(5000);
                                                    let indexcorrecto = taskarray.indexOf(taskarray2[contadorTareas2]);
                                                    let objHMP = statusHMP[indexcorrecto];
                                                    ///primer try
                                                    try {
                                                        //Cambiamos al frame donde aparece el botón de liberación
                                                        let iframe = await funciones.cambiarFrameDescargaDocumento(page);
                                                        if (correctos[indexcorrecto] && objHMP.statusCargado) {
                                                            console.log('Entrando a proceso de liberación');
                                                            logger.info('Entrando a proceso de liberación');
                                                            await sleep(5000);
                                                            //Ingreso de comentario "Se libera carga"
                                                            try {
                                                                await iframe.waitForSelector("input[id='pt1:r1:0:pt1:pt_r2r:0:pc1:t2:0:it1::content']", { timeout: 18000 });
                                                                await iframe.type("input[id='pt1:r1:0:pt1:pt_r2r:0:pc1:t2:0:it1::content']", process.env.STRING_CONFIRMA, { delay: 100 });
                                                            } catch (error) {
                                                                try {
                                                                    console.log('No se encontró input, se prueba con Textarea');
                                                                    logger.info('No se encontró input, se prueba con Textarea');
                                                                    await iframe.waitForSelector("textarea[id='pt1:r1:0:ptVRL:pt_r2:0:pc1:t1:0:it3::content']", { timeout: 18000 });
                                                                    await iframe.type("textarea[id='pt1:r1:0:ptVRL:pt_r2:0:pc1:t1:0:it3::content']", process.env.STRING_CONFIRMA, { delay: 100 });
                                                                } catch (error) {
                                                                    console.log('No se encontro ningun elemento para ingresar comentario');
                                                                    logger.info('No se encontro ningun elemento para ingresar comentario');
                                                                    intento++;
                                                                }
                                                            }
                                                            //Validando frame, tarea es la misma que el nombre que aparece en el iframe
                                                            try {
                                                                await iframe.waitForSelector("td[id ='pt1:ph1::_afrTtxt'] > div > h1 ", { timeout: 18000 });
                                                                //console.log('paso el wait')
                                                                let tareaFrame = await iframe.$eval("td[id ='pt1:ph1::_afrTtxt'] > div > h1 ", (el) => el.innerHTML);
                                                                //tareaFrame = tareaFrame.replace('Validar Carga de Tarifas ', '')
                                                                tareaFrame = tareaFrame.replace('Validate Rates Load ', '').replace('Validates Load of Rates ', '').replace('Validar carga de tarifas ', '').replace('Validar Carga de Tarifas ', '').replace('amp;', '');
                                                                tareaFrame = tareaFrame.trim();
                                                                //console.log('-'+name+'-')
                                                                tareaFrame = tareaFrame.replace(/\s+/g, '');
                                                                let tareaProcesa = taskarray2[contadorTareas2].replace(/\s+/g, '');
                                                                //console.log('-'+name+'-')
                                                                console.log('Tarea a procesar -' + tareaProcesa + '-' + 'Tarea en frame -' + tareaFrame + '-');
                                                                logger.info('Tarea a procesar -' + tareaProcesa + '-' + 'Tarea en frame -' + tareaFrame + '-');
                                                                //Valida tarea con FRAME
                                                                if (tareaFrame == tareaProcesa) {
                                                                    console.log('Es el mismo proceso a liberar');
                                                                    logger.info('Es el mismo proceso a liberar');
                                                                    //Se libera la tarea del DAT
                                                                    try {
                                                                        await iframe.waitForSelector(" div[id='pt1:b1'] > a", { timeout: 300000 });
                                                                        await iframe.click(" div[id='pt1:b1'] > a");
                                                                        await sleep(5000);
                                                                        contadorliberados++;
                                                                        validar = 1;
                                                                        tareaLiberada = 1;
                                                                        console.log('Se ha liberado una tarea de DAT');
                                                                        logger.info('Se ha liberado una tarea de DAT');
                                                                        intento = 3;
                                                                    } catch (error) {
                                                                        console.log('No pudo realizar la liberación de la tarea');
                                                                        logger.info('No pudo realizar la liberación de la tarea');
                                                                        tareaLiberada = 0;
                                                                        intento++;
                                                                    }
                                                                } else {
                                                                    console.log('No es la misma tarea');
                                                                    logger.info('No es la misma tarea');
                                                                    intento++;
                                                                    //funciones.alertaErrorLiberar(taskarray2[contadorTareas2])
                                                                }
                                                            } catch (error) {
                                                                console.log('Error en la validación de frame y  liberación ' + error);
                                                                logger.info('Error en la validación de frame y  liberación ' + error);
                                                                intento++;
                                                                //funciones.alertaErrorLiberar(taskarray2[contadorTareas2])
                                                            }
                                                        } else {
                                                            console.log('Se omite tarea para liberar, no ha sido correcta su carga a HMP o generación de leyenda');
                                                            logger.info('Se omite tarea para liberar, no ha sido correcta su carga a HMP o generación de leyenda');
                                                            intento = 3;
                                                        }

                                                        ///fuera del segundo try
                                                        if (intento == 3) {
                                                            console.log('termino ciclo de liberacion');
                                                            logger.info('termino ciclo de liberacion');
                                                            //Se actualiza o se registra la tarea en BD
                                                            let stringmailbd = observacionesGDL[indexcorrecto] + '\n' + objHMP.desc;
                                                            if (await funcionesBD.checkifExistsTareaDat(taskarray2[contadorTareas2])) {
                                                                await funcionesBD.actualizaProcesoTerminadoDAT(taskarray2[contadorTareas2], numLeyendas[indexcorrecto], await funcionesBD.generaFechaSQL(), objHMP.statusCargado, stringmailbd);
                                                                console.log('datos para actualizar terminado DAT', taskarray2[contadorTareas2], numLeyendas[indexcorrecto], await funcionesBD.generaFechaSQL(), objHMP.statusCargado, stringmailbd);
                                                                logger.info('datos para actualizar terminado DAT', taskarray2[contadorTareas2], numLeyendas[indexcorrecto], await funcionesBD.generaFechaSQL(), objHMP.statusCargado, stringmailbd);
                                                                console.log('Archivo en BD Actualizado');
                                                                logger.info('Archivo en BD Actualizado');
                                                            } else {
                                                                await funcionesBD.insertaProcesoTerminadoDAT(taskarray2[contadorTareas2], numLeyendas[indexcorrecto], await funcionesBD.generaFechaSQL(), objHMP.statusCargado, stringmailbd);
                                                                console.log('Archivo en BD insertado');
                                                                logger.info('Archivo en BD insertado');
                                                                console.log('datos en insert',  taskarray2[contadorTareas2], numLeyendas[indexcorrecto], await funcionesBD.generaFechaSQL(), objHMP.statusCargado, stringmailbd );
                                                                logger.info('datos en insert', taskarray2[contadorTareas2], numLeyendas[indexcorrecto], await funcionesBD.generaFechaSQL(), objHMP.statusCargado, stringmailbd );
                                                            }

                                                            //En caso de que el archivo haya sido erroneo
                                                            if (await funcionesBD.checkifExistsTareaError(taskarray2[contadorTareas2])) {
                                                                if (objHMP.statusCargado) {
                                                                    await funcionesBD.eliminaTareaError(taskarray2[contadorTareas2]);
                                                                    console.log('Se elimina de tareas en espera');
                                                                    logger.info('Se elimina de tareas en espera');
                                                                    //Se envia correo de estatus de la tarea
                                                                    if (tareaLiberada == 1 && validar == 1) {
                                                                        ///si fue liberada envia correo de status
                                                                        console.log('se  envia correo de liberacion');
                                                                        logger.info('se  envia correo de liberacion')
                                                                        let stringmail = observacionesGDL[indexcorrecto] + '\n' + objHMP.desc;
                                                                        await funciones.enviaCorreo(stringmail, cuentas[indexcorrecto], numsols[indexcorrecto]);
                                                                        //await funciones.enviaCorreo(stringmail, cuentas[indexcorrecto], numsols[indexcorrecto]);
                                                                    } else {
                                                                        //si no libero la tarea se envia correo de error liberacion
                                                                        let stringmail = observacionesGDL[indexcorrecto] + '\n' + objHMP.desc;
                                                                        await funciones.alertaErrorLiberar(taskarray2[contadorTareas2], stringmail);
                                                                        console.log('No  valido o libero la tarea envio error');
                                                                        logger.info('No  valido o libero la tarea envio error');
                                                                    }
                                                                } else {
                                                                    let actionError = await funcionesBD.consultaUltimoIntentoDAT(taskarray2[contadorTareas2]);
                                                                    if (actionError == 'WAIT') {
                                                                        console.log('Tarea en espera, no se ha procesado todavía, esperar 24h');
                                                                        logger.info('Tarea en espera, no se ha procesado todavía, esperar 24h');
                                                                    } else {
                                                                        let iderror = await funcionesBD.consigueIDTareaError(taskarray2[contadorTareas2]);
                                                                        await funcionesBD.actualizaTareaError(iderror, await funcionesBD.generaFechaSQL());
                                                                        console.log('Archivo procesado con error nuevamente, se espera a próximo día');
                                                                        logger.info('Archivo procesado con error nuevamente, se espera a próximo día');
                                                                        let stringmail = observacionesGDL[indexcorrecto] + '\n' + objHMP.desc;
                                                                        await funciones.enviaCorreo(stringmail, cuentas[indexcorrecto], numsols[indexcorrecto]);
                                                                    }
                                                                }
                                                            } else {
                                                                if (objHMP.statusCargado && tareaLiberada == 0 && validar == 0) {
                                                                    //no se pudo liberar
                                                                    let stringmail = observacionesGDL[indexcorrecto] + '\n' + objHMP.desc;
                                                                    await funciones.alertaErrorLiberar(taskarray2[contadorTareas2], stringmail);
                                                                    console.log(' Tarea error en la liberación, en la próxima iteración se volvera a intentar');
                                                                    logger.info(' Tarea error en la liberación, en la próxima iteración se volvera a intentar');
                                                                } else {
                                                                    if (!objHMP.statusCargado) {
                                                                        if (objHMP.desc != 'Ocurrió un error con la plataforma HMP') {
                                                                            await funcionesBD.insertaTareaErroneo(taskarray2[contadorTareas2], await funcionesBD.generaFechaSQL());
                                                                            console.log('Se inserta en tareas erróneas');
                                                                            logger.info('Se inserta en tareas erróneas');
                                                                        } else {
                                                                            console.log('Se retoma para próxima iteración el archivo');
                                                                            logger.info('Se retoma para próxima iteración el archivo');
                                                                        }
                                                                    }
                                                                    //Se envia correo de estatus de la tare
                                                                    let stringmail = observacionesGDL[indexcorrecto] + '\n' + objHMP.desc;
                                                                    let envio =await funciones.enviaCorreo(stringmail, cuentas[indexcorrecto], numsols[indexcorrecto]);
                                                                    if(!envio){
                                                                        console.log('reintento de envio correo ')
                                                                        await funciones.enviaCorreo(stringmail, cuentas[indexcorrecto], numsols[indexcorrecto]);
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    } catch (error) {
                                                        console.log('Error desde cambio a frame ' + error);
                                                        logger.info('Error desde cambio a frame ' + error);
                                                    }
                                                } else {
                                                    console.log('Ya se valido  o termino intentos');
                                                    logger.info('Ya se valido  o termino intentos');
                                                }
                                            }
                                        } else {
                                            console.log('Se omite tarea ' + taskarray2[contadorTareas2] + ', aún no se ha descargado archivo de tarifas y suplementos');
                                            logger.info('Se omite tarea ' + taskarray2[contadorTareas2] + ', aún no se ha descargado archivo de tarifas y suplementos');
                                        }
                                        contadorTareas2++;
                                    }
                                }
                                console.log('Se liberaron ' + contadorliberados + ' tareas de ' + taskarray.length);
                                logger.info('Se liberaron ' + contadorliberados + ' tareas de ' + taskarray.length);
                            } else {
                                console.log('NO SE DETECTARON TAREAS PARA LIBERAR');
                                logger.info('NO SE DETECTARON TAREAS PARA LIBERAR');
                            }
                        } else {
                            console.log('No se detectaron tareas nuevas');
                            logger.info('No se detectaron tareas nuevas');
                        }
                        //LogOut
                        await page.waitForSelector("div[id='wlctdc:wlhtdc:j_id__ctru8:usrD1'] > div", { timeout: 300000 });
                        await page.click("div[id='wlctdc:wlhtdc:j_id__ctru8:usrD1'] > div");
                        await page.waitForSelector("tr[id='wlctdc:wlhtdc:j_id__ctru8:j_id__ctru12pc2'] > td.x19c", { timeout: 300000 });
                        await page.click("tr[id='wlctdc:wlhtdc:j_id__ctru8:j_id__ctru12pc2'] > td.x19c");
                        await sleep(2500);
                        await browser.close();
                        await funcionesBD.insertaProcesoLog(inicioproceso, await funcionesBD.generaFechaSQL(), contadorliberados, totalleyendas, true);
                        console.log('Se ha terminado un flujo..., volviendo a posición inicial....');
                        logger.info('Se ha terminado un flujo..., volviendo a posición inicial....');
                        await sleep(15000);
                        await sleep(15000);
                    } else {
                        console.log('Robot detenido, no hay credenciales válidas');
                        logger.info('Robot detenido, no hay credenciales válidas');
                        await sleep(3600000);
                    }
                    //console.log('FIN PROCESO-PRUEBA');
                    // break;
                } catch (e) {
                    console.log('Ha ocurrido un error, reiniciando robot....');
                    logger.info('Ha ocurrido un error, reiniciando robot....');
                    await funciones.sendXiraEmailError(e);
                    console.error(`Se envió notificación de la falla: ` + e);
                    logger.error(`Se envió notificación de la falla: ` + e);
                    await funcionesBD.insertaError(String(e).slice(0, 119), 'RPA Convenios', await funcionesBD.generaFechaSQL());
                    console.log('Se ha registrado el error en BD');
                    logger.info('Se ha registrado el error en BD');
                    if (inicioproceso == '') inicioproceso = await funcionesBD.generaFechaSQL();
                    await funcionesBD.insertaProcesoLog(await funcionesBD.generaFechaSQL(), await funcionesBD.generaFechaSQL(), contadorliberados, totalleyendas, false);
                    console.log('Se ha terminado un flujo..., volviendo a posición inicial....');
                    logger.info('Se ha terminado un flujo..., volviendo a posición inicial....');
                    if (browser) {
                        await browser.close();
                    }
                    await sleep(5000);
                    //break
                }
            }
        } else {
            console.log('Fuera de ventana de trabajo, hay que esperar');
            logger.info('Fuera de ventana de trabajo, hay que esperar');
            //process.exit(1);
            await sleep(3600000);
        }
    }
})().catch((e) => {
    console.log('EL RPA HA DETECTADO UN ERROR!');
    logger.info('EL RPA HA DETECTADO UN ERROR!')
    console.log(e);
    logger.info(e);
    console.log('Favor de revisar');
    logger.info('Favor de revisar');
});
