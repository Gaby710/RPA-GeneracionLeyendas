const xlsx = require('xlsx');
const ObjectsToCsv = require('objects-to-csv');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const puppeteer = require('puppeteer');
const sleep = require('sleep-promise');
const nodemailer = require('nodemailer');
const funcionesBD = require('./funcionesBD');
const { count } = require('console');
const { Logger } = require('node-logger');
dotenv.config();
const logger = require('node-logger').createLogger('logs_ConveniosGDL.txt');

//Funciones
async function procesoGeneracionLeyendas(taskname) {
    let contrato = '';
    let numsol = taskname;
    //mov de variables error valorlocal no encontrado
    let valorcorp;
    let valorlocal;
    numsol = numsol.replace('gv1pvap', '');
    numsol = numsol.replace(/\D/g, '');
    try {
        let wb = xlsx.readFile(path.join(process.env.DOWNLOAD_PATH, taskname + process.env.EXTENSION), { cellText: false, cellDates: true, dateNF: false });
        let first_sheet_name = wb.SheetNames[0];
        let worksheet = wb.Sheets[first_sheet_name];
        let range = xlsx.utils.decode_range(worksheet['!ref']);
        //Obtener la lista de hoteles a procesar
        let hotelarray = [];
        let codhotelarray = [];
        let unicoshot = [];
        let unicoscod = [];
        let ocurrences = [];
        let falla = '';
        let avisocero = '';
        let avisoexpirada = '';
        let avisoDec = '';
        let avisohab = '';
        let flagcero = false;
        for (let rowNum = range.s.r + 1; rowNum <= range.e.r; rowNum++) {
            let hotel = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 1 })];
            let codigo = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 2 })];
            if (hotel) {
                if (hotel.v == 'COMPULSORY' || hotel.v == 'PREFERRED' || hotel.v == 'VOLUNTEER') {
                    hotel.v = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 2 })].v;
                    codigo.v = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 3 })].v;
                }
            } else {
                hotel = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 2 })];
                codigo = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 3 })];
            }
            if (!hotelarray.includes(hotel.v) && !codhotelarray.includes(codigo.v)) {
                unicoshot.push(hotel.v);
                unicoscod.push(codigo.v);
            }
            hotelarray.push(hotel.v);
            codhotelarray.push(codigo.v);
        }

        for (let i = 0; i < unicoshot.length; i++) {
            let a = await obtenerNumeroOcurrencias(hotelarray, unicoshot[i]);
            ocurrences.push(a);
        }

        //Por cada hotel, obtener el número de contrato
        let shift = 0;
        contrato = worksheet[xlsx.utils.encode_cell({ r: 1, c: 24 })].v;
        let isnum = /^\d+$/.test(contrato);
        if (isnum) {
            contrato = worksheet[xlsx.utils.encode_cell({ r: 1, c: 25 })].v;
            shift = 1;
        }
        let convEspecial = false;
        let rfpsEspecial = false;
        let aux = '';
        let ccespecial = '';
        let flagEspecial = await checkEspecial(contrato);
        if (flagEspecial) {
            flagEspecial = true;
            convEspecial = true;
        } else {
            aux = await checkRFPSESPECIAL(contrato);
            if (aux.flag) {
                flagEspecial = true;
                rfpsEspecial = true;
                ccespecial = aux.cuentacompartida;
            }
        }

        let leyendaDESCBRIEF = '';
        let leyendaADDINFO = '';
        let rfpsEspecialcc = false;

        //Verificar si es convenio local o corporativo y buscar leyenda del convenio
        //mov por error valorlocal
        //let valorcorp = await obtenerLeyendaCorporativo(contrato);
        //let valorlocal = undefined;
        valorcorp = await obtenerLeyendaCorporativo(contrato);
        valorlocal = undefined;
        let flagcorp = false;
        let flaglocal = false;
        let flagencontrado = false;
        let cuentacompartida = '';
        let cuentas = [];
        let cc = [];
        let descripciones = [];
        let flagsindesc = false;
        let multiplescompartidas = [];

        //OBTENER CUENTAS COMPARTIDAS
        if (!flagEspecial) {
            if (valorcorp || contrato.includes('L')) {
                flagcorp = true;
                if (contrato.includes('L')) {
                    valorcorp = await obtenerLeyendaLocal(contrato);
                }
                if (valorcorp) {
                    if (valorcorp.substr(-1) == ' ') valorcorp = valorcorp.slice(0, -1);
                    console.log(valorcorp);
                    flagencontrado = true;
                    cuentacompartida = await obtenerCuentaCompartidaCorporativo(contrato);
                    descripciones = await obtenerDescripciones(contrato);
                    if (descripciones.length == 0) flagsindesc = true;
                    if (cuentacompartida) {
                        if (cuentacompartida.length <= 7) {
                            console.log(contrato + ' TIENE CUENTA COMPARTIDA con ' + cuentacompartida);
                            cuentas.push(valorcorp);
                            let ax = await obtenerLeyendaLocal(cuentacompartida);
                            cuentas.push(ax);
                            rfpsEspecialcc = await checkRFPSESPECIAL(cuentacompartida);
                            cc.push(contrato);
                            cc.push(cuentacompartida);
                        } else {
                            multiplescompartidas = await separador(cuentacompartida);
                            for (let i = 0; i < multiplescompartidas.length; i++) {
                                console.log(contrato + ' TIENE CUENTA COMPARTIDA con ' + multiplescompartidas[i]);
                                if (i == 0) cuentas.push(valorcorp);
                                let ax = await obtenerLeyendaLocal(multiplescompartidas[i]);
                                cuentas.push(ax);
                                if (i == 0) cc.push(contrato);
                                cc.push(multiplescompartidas[i]);
                            }
                        }
                    } else {
                        console.log('NO ES COMPARTIDA');
                    }
                }
            } else {
                valorlocal = await obtenerLeyendaLocal(contrato);
                console.log('valorlocal obtenido de obtenerleyendalo', valorlocal)
                if (valorlocal) {
                    flaglocal = true;
                    if (valorlocal.substr(-1) == ' ') valorlocal = valorlocal.slice(0, -1);
                    console.log(valorlocal);
                    descripciones = await obtenerDescripciones(contrato);
                    if (descripciones.length == 0) flagsindesc = true;
                    flagencontrado = true;
                } else {
                    console.log("El contrato: '" + contrato + "' no se encuentra en los archivos de convenios");
                }
            }
        } else {
            if (valorcorp) {
                flagcorp = true;
                if (valorcorp.substr(-1) == ' ') valorcorp = valorcorp.slice(0, -1);
                console.log(valorcorp);
                flagencontrado = true;
                cuentacompartida = await obtenerCuentaCompartidaCorporativo(contrato);
                descripciones = await obtenerDescripciones(contrato);
                if (descripciones.length == 0) flagsindesc = true;
                if (cuentacompartida) {
                    if (cuentacompartida.length <= 7) {
                        console.log(contrato + ' TIENE CUENTA COMPARTIDA con ' + cuentacompartida);
                        cuentas.push(valorcorp);
                        let ax = await obtenerLeyendaLocal(cuentacompartida);
                        cuentas.push(ax);
                        cc.push(contrato);
                        cc.push(cuentacompartida);
                    } else {
                        multiplescompartidas = await separador(cuentacompartida);
                        for (let i = 0; i < multiplescompartidas.length; i++) {
                            console.log(contrato + ' TIENE CUENTA COMPARTIDA con ' + multiplescompartidas[i]);
                            if (i == 0) cuentas.push(valorcorp);
                            let ax = await obtenerLeyendaLocal(multiplescompartidas[i]);
                            cuentas.push(ax);
                            if (i == 0) cc.push(contrato);
                            cc.push(multiplescompartidas[i]);
                        }
                    }
                } else {
                    console.log('NO ES COMPARTIDA');
                }
            } else {
                valorlocal = await obtenerLeyendaLocal(contrato);
                if (valorlocal) {
                    flaglocal = true;
                    if (valorlocal.substr(-1) == ' ') valorlocal = valorlocal.slice(0, -1);
                    console.log('Genera convenio valor local', valorlocal);
                    descripciones = await obtenerDescripciones(contrato);
                    if (descripciones.length == 0) flagsindesc = true;
                    flagencontrado = true;
                    if (ccespecial != 'NO') {
                        console.log(contrato + ' TIENE CUENTA COMPARTIDA con ' + ccespecial);
                        cuentas.push(valorlocal);
                        let ax = await obtenerLeyendaLocal(ccespecial);
                        cuentas.push(ax);
                        cc.push(contrato);
                        cc.push(ccespecial);
                    }
                } else {
                    console.log("El contrato: '" + contrato + "' no se encuentra en los archivos de convenios");
                }
            }
        }

        //Revisar habitaciones ¿Son varios tipos de habitaciones?
        let precios = [];
        let fechasinicio = [];
        let fechasfin = [];
        let tiposhab = [];
        let categorias = [];
        let condicionesBKFST = [];
        let preciosBKFST = [];
        let tipohot = [];
        let precioleyenda = [];
        let habitacionleyenda = [];
        let desayunoleyenda = [];
        let tarifassencillas = [];
        let tarifasdobles = [];
        let tarifassencillasBKFST = [];
        let tarifasdoblesBKFST = [];
        let leyendasceldas = {};
        let temporadas = [];

        let suma = 0;
        let sumadesayuno = 0;
        let flagBKFST = false;
        let flagmultiples = false;
        let marca = '';
        let rowNum = 1;

        let flagerror = false;
        let flagDecimal = false;

        let carga = [];
        let objresp = {};
        let contadorceros = 0;
        let contadoromitefechas = 0;
        let contadorhab = 0;
        let contadorDec = 0;
        if (flagsindesc) flagencontrado = false;
        if (flagencontrado) {
            for (let j = 0; j < ocurrences.length; j++) {
                console.log('Analizando celdas de hotel ' + unicoshot[j]);
                let flagomitir = false;
                let flagproceso = true;
                let contador = 0;
                let flagdolar = false;
                let flagALLINCLUSIVE = false;
                let flaginvertir = false;
                flagDecimal = false;
                flagBKFST = false;
                flagmultiples = false;
                flagcero = false;
                suma = 0;
                sumadesayuno = 0;
                precios = [];
                fechasinicio = [];
                fechasfin = [];
                tiposhab = [];
                categorias = [];
                condicionesBKFST = [];
                preciosBKFST = [];
                precioleyenda = [];
                habitacionleyenda = [];
                leyendasceldas = [];
                desayunoleyenda = [];
                monedas = [];
                tipohot = [];
                temporadas = [];
                tarifassencillas = [];
                tarifasdobles = [];
                tarifassencillasBKFST = [];
                tarifasdoblesBKFST = [];
                for (contador; contador < ocurrences[j]; contador++) {
                    let tipohab = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 22 + shift })].v;
                    let x = await obtenerLeyendaHabitacion(tipohab, unicoscod[j]);
                    console.log('dato en obtenerLeyebdaHabitacion 289', x)
                    if (x != 'NO APLICA') {
                        tiposhab.push(x);
                        let moneda = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 10 + shift })].v;
                        monedas.push(moneda);
                        let tipohotv = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 4 + shift })].v;
                        tipohot.push(tipohotv);
                        let temporada = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 5 + shift })].v;
                        temporadas.push(temporada);
                        let inicio = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 6 + shift })];
                        if (inicio.w) {
                            inicio = await dateFormatter(inicio.w);
                            fechasinicio.push(inicio);
                        } else if (typeof inicio.v == 'string') {
                            fechasinicio.push(inicio.v);
                        } else {
                            fechasinicio.push(await recortarGMT(inicio.v));
                        }
                        let final = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 7 + shift })];
                        if (final.w) {
                            final = await dateFormatter(final.w);
                            fechasfin.push(final);
                        } else if (typeof final.v == 'string') {
                            fechasfin.push(final.v);
                        } else {
                            fechasfin.push(await recortarGMT(final.v));
                        }
                        let categoria = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 9 + shift })].v;
                        categorias.push(categoria);

                        let a = worksheet[xlsx.utils.encode_cell({ r: 0, c: 11 + shift })].v;
                        let adjustment = 0;
                        if (!a.includes('Nivel')) {
                            adjustment = -1;
                        }

                        let precio = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 12 + shift + adjustment })].v;
                        precios.push(precio);
                        if (precio % 1 != 0 && moneda == 'MXN') flagDecimal = true;

                        let tarifasencilla = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 12 + shift + adjustment })].v;
                        tarifassencillas.push(tarifasencilla);
                        if (tarifasencilla % 1 != 0 && moneda == 'MXN') flagDecimal = true;

                        let tarifasencillaBKFST = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 13 + shift + adjustment })].v;
                        tarifassencillasBKFST.push(tarifasencillaBKFST);
                        if (tarifasencillaBKFST % 1 != 0 && moneda == 'MXN') flagDecimal = true;

                        let tarifadoble = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 14 + shift + adjustment })].v;
                        tarifasdobles.push(tarifadoble);
                        if (tarifadoble % 1 != 0 && moneda == 'MXN') flagDecimal = true;

                        let tarifadobleBKFST = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 15 + shift + adjustment })].v;
                        tarifasdoblesBKFST.push(tarifadobleBKFST);
                        if (tarifadobleBKFST % 1 != 0 && moneda == 'MXN') flagDecimal = true;

                        let condicionBKFST = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 17 + shift })].v;
                        condicionesBKFST.push(condicionBKFST);

                        let precioBKFST = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 18 + shift })].v;
                        preciosBKFST.push(precioBKFST);
                        if (precioBKFST % 1 != 0 && moneda == 'MXN') flagDecimal = true;
                    }
                    rowNum++;
                }
                if (tarifasdoblesBKFST[0] < tarifasdobles[0]) {
                    let tmp = [...tarifasdobles];
                    tarifasdobles = [...tarifasdoblesBKFST];
                    tarifasdoblesBKFST = tmp;
                }
                if (!flagDecimal) {
                    if (await arreglosFechaIguales(fechasinicio, fechasfin)) {
                        let inicio_comparar = fechasinicio[0];
                        let fin_comparar = fechasfin[0];
                        let hoy = await diaHoy();

                        let A_hoy = hoy.split('/');
                        let A_inicio = inicio_comparar.split('/');
                        let A_fin = fin_comparar.split('/');

                        if (A_inicio[2].length == 2) {
                            A_inicio[2] = '20' + A_inicio[2];
                        }
                        if (A_fin[2].length == 2) {
                            A_fin[2] = '20' + A_fin[2];
                        }

                        let hoyDATE = new Date(A_hoy[2], A_hoy[1], A_hoy[0]);
                        let inicioDATE = new Date(A_inicio[2], A_inicio[1], A_inicio[0]);
                        let finDATE = new Date(A_fin[2], A_fin[1], A_fin[0]);

                        if (finDATE < hoyDATE) {
                            console.log('SE DETECTÓ UNA VIGENCIA EXPIRADA, SE OMITE REGISTRO');
                            flagomitir = true;
                        } else if (hoyDATE > inicioDATE) {
                            console.log('SE DETECTÓ UNA VIGENCIA QUE ESTÁ EN CURSO, ACTUALIZA A DÍA DE HOY');
                            fechasinicio.fill(hoy);
                        } else if (hoyDATE < inicioDATE) {
                            console.log('SE DEJA FECHA INTACTA, LA VIGENCIA NO HA COMENZADO');
                        }

                        if (!flagomitir) {
                            if (tiposhab.length != 0) {
                                habitacionleyenda = await obtenerMenoresTiposHab(tiposhab);
                                //let objvalido = await rangoValido(precios, monedas, unicoshot[j]);

                                if (precios.includes(0)) {
                                    console.log('flagcero true 396', precios.includes(0))
                                    //flagcero = true;
                                    //contadorceros++;
                                }

                                flagALLINCLUSIVE = tipohot[0].includes('ALL INCLUSIVE');
                                flaginvertir = tiposhab.indexOf(habitacionleyenda[0]) > tiposhab.indexOf(habitacionleyenda[1]);
                                for (let i = 0; i < precios.length; i++) {
                                    if (condicionesBKFST[0] == 'V') flagBKFST = true;
                                    if (monedas[i] == 'MXN') {
                                        suma = tarifassencillasBKFST[i];
                                        sumadesayuno = tarifasdoblesBKFST[i];
                                        if (!precioleyenda.includes(suma) && habitacionleyenda.includes(tiposhab[i])) {
                                            precioleyenda.push(suma);
                                        }
                                        if (!desayunoleyenda.includes(sumadesayuno) && habitacionleyenda.includes(tiposhab[i]) && (flagBKFST || flagALLINCLUSIVE)) {
                                            desayunoleyenda.push(sumadesayuno);
                                        }
                                    }
                                }
                                //console.log(precioleyenda)
                            } else {
                                console.log('No se han encontrado habitaciones aplicables para la generación de leyenda DESCBRIEF');
                                flagproceso = false;
                                contadorhab++;
                            }
                            if (precioleyenda[0] == 0 || precioleyenda.length == 0) {
                                flagdolar = true;
                            }
                        } else {
                            contadoromitefechas++;
                        }
                    } else {
                        if (tiposhab.length != 0) {
                            flagmultiples = true;
                            console.log('Ejecutar algoritmo múltiples fechas');
                            leyendasceldas = await generaLeyendasMultiplesFechas(precios, preciosBKFST, monedas, fechasinicio, fechasfin, tiposhab, condicionesBKFST, categorias, cc, unicoscod[j], unicoshot[j], cuentas, flagEspecial, valorlocal, valorcorp, contrato, flaglocal, flagcorp, descripciones, rfpsEspecial, ccespecial, tipohot[0].includes('ALL INCLUSIVE'), tarifassencillasBKFST, tarifasdoblesBKFST, rfpsEspecialcc);
                        } else {
                            console.log('No se han encontrado habitaciones aplicables para la generación de leyenda DESCBRIEF');
                            flagproceso = false;
                            contadorhab++;
                        }
                    }
                } else {
                    contadorDec++;
                }

                //Si hay habitaciones válidas//Todo salió bien analizando el archivo
                if (flagproceso && !flagmultiples && !flagcero && !flagomitir && !flagDecimal) {
                    //Si hay que generar leyendas especiales
                    if (!flagEspecial) {
                        //Cuentas compartidas (Se generan DOS pares de leyendas)
                        if (cuentas.length != 0) {
                            for (let i = 0; i < cuentas.length; i++) {
                                if (valorlocal) {
                                    marca = await obtenerMarcaLocal(unicoscod[j]);
                                    leyendaADDINFO = await generarLeyendaADDINFOlocal(marca, flagEspecial, flagBKFST);
                                } else if (i == 0) {
                                    marca = await obtenerMarcaCorp(unicoscod[j]);
                                    leyendaADDINFO = await generarLeyendaADDINFOcorp(marca, flagEspecial, flagBKFST);
                                } else {
                                    if (rfpsEspecialcc.flag) {
                                        let especial = await obtenerRFPSESPECIAL(cc[i], unicoscod[j], contrato);
                                        if (especial.flagencontrado && !especial.flagomitir && !especial.vacio) {
                                            leyendaADDINFO = especial.carga.Description;
                                        } else {
                                            marca = await obtenerMarcaLocal(unicoscod[j]);
                                            leyendaADDINFO = await generarLeyendaADDINFOlocal(marca, flagEspecial, flagBKFST);
                                        }
                                    } else {
                                        marca = await obtenerMarcaLocal(unicoscod[j]);
                                        leyendaADDINFO = await generarLeyendaADDINFOlocal(marca, flagEspecial, flagBKFST);
                                    }
                                }
                                if (leyendaADDINFO) {
                                    leyendaDESCBRIEF = await cortarLeyendaDESCBRIEF(cuentas[i], habitacionleyenda, precioleyenda, desayunoleyenda, flagBKFST, flagdolar, flaglocal, flagcorp, descripciones, unicoshot[j], flagALLINCLUSIVE, flagEspecial, flaginvertir);
                                    console.log(leyendaDESCBRIEF + '466');
                                    let jsoncarga = await generaJSON(unicoscod[j], cc[i], 'DESCBRIEF', fechasinicio[0], fechasfin[0], leyendaDESCBRIEF);
                                    carga.push(jsoncarga);
                                    if (cc[i].includes('CU')) {
                                        jsoncarga = await generaJSON(unicoscod[j], cc[i], 'DESCBRIEF', fechasinicio[0], fechasfin[0], leyendaDESCBRIEF, 'PEG', 'PEGASUS');
                                        carga.push(jsoncarga);
                                    }
                                    console.log(leyendaADDINFO);
                                    jsoncarga = await generaJSON(unicoscod[j], cc[i], 'ADDINFO', fechasinicio[0], fechasfin[0], leyendaADDINFO);
                                    carga.push(jsoncarga);
                                } else {
                                    console.log('Ha ocurrido un error, un campo para la generación de la leyenda ADDINFO no se encuentra disponible');
                                    falla = falla + 'El Hotel ' + unicoshot[j] + '(' + unicoscod[j] + ') no posee datos para la generación de leyenda ADDINFO\n';
                                    flagerror = true;
                                    break;
                                }
                            }
                            if (flagerror) break;
                        } else {
                            //Cuenta separada (se genera un par de leyendas)
                            if (valorlocal) {
                                marca = await obtenerMarcaLocal(unicoscod[j]);
                                leyendaADDINFO = await generarLeyendaADDINFOlocal(marca, flagEspecial, flagBKFST);
                            } else {
                                marca = await obtenerMarcaCorp(unicoscod[j]);
                                leyendaADDINFO = await generarLeyendaADDINFOcorp(marca, flagEspecial, flagBKFST);
                            }
                            if (leyendaADDINFO) {
                                leyendaDESCBRIEF = await cortarLeyendaDESCBRIEF(valorlocal || valorcorp, habitacionleyenda, precioleyenda, desayunoleyenda, flagBKFST, flagdolar, flaglocal, flagcorp, descripciones, unicoshot[j], flagALLINCLUSIVE, flagEspecial, flaginvertir);
                                console.log(leyendaDESCBRIEF + '495');
                                let jsoncarga = await generaJSON(unicoscod[j], contrato, 'DESCBRIEF', fechasinicio[0], fechasfin[0], leyendaDESCBRIEF);
                                carga.push(jsoncarga);
                                if (contrato.includes('CU')) {
                                    jsoncarga = await generaJSON(unicoscod[j], contrato, 'DESCBRIEF', fechasinicio[0], fechasfin[0], leyendaDESCBRIEF, 'PEG', 'PEGASUS');
                                    carga.push(jsoncarga);
                                }
                                console.log(leyendaADDINFO);
                                jsoncarga = await generaJSON(unicoscod[j], contrato, 'ADDINFO', fechasinicio[0], fechasfin[0], leyendaADDINFO);
                                carga.push(jsoncarga);
                            } else {
                                console.log('HA OCURRIDO UN ERROR EN LA GENERACIÓN DE LEYENDA ADDINFO PARA CUENTAS SEPARADAS');
                                flagerror = true;
                                falla = falla + 'El Hotel ' + unicoshot[j] + '(' + unicoscod[j] + ')  no posee datos para la generación de leyenda ADDINFO\n';
                                break;
                            }
                        }
                    } else {
                        if (rfpsEspecial) {
                            let especial = await obtenerRFPSESPECIAL(contrato, unicoscod[j], ccespecial);
                            if (especial.flagencontrado && !especial.flagomitir && !especial.vacio && false) {
                                leyendaADDINFO = especial.carga;
                                leyendaDESCBRIEF = await cortarLeyendaDESCBRIEF(valorlocal || valorcorp, habitacionleyenda, precioleyenda, desayunoleyenda, flagBKFST, flagdolar, flaglocal, flagcorp, descripciones, unicoshot[j], flagALLINCLUSIVE, flagEspecial, flaginvertir);
                                console.log(leyendaDESCBRIEF);
                                let jsoncarga = await generaJSON(unicoscod[j], contrato, 'DESCBRIEF', fechasinicio[0], fechasfin[0], leyendaDESCBRIEF);
                                carga.push(jsoncarga);
                                if (contrato.includes('CU')) {
                                    jsoncarga = await generaJSON(unicoscod[j], contrato, 'DESCBRIEF', fechasinicio[0], fechasfin[0], leyendaDESCBRIEF, 'PEG', 'PEGASUS');
                                    carga.push(jsoncarga);
                                }
                                console.log(leyendaADDINFO);
                                carga.push(leyendaADDINFO);
                                if (ccespecial != 'NO') {
                                    marca = await obtenerMarcaCorp(unicoscod[j]);
                                    leyendaADDINFO = await generarLeyendaADDINFOcorp(marca, flagEspecial, flagBKFST);
                                    if (leyendaADDINFO) {
                                        leyendaDESCBRIEF = await cortarLeyendaDESCBRIEF(valorlocal || valorcorp, habitacionleyenda, precioleyenda, desayunoleyenda, flagBKFST, flagdolar, flaglocal, flagcorp, descripciones, unicoshot[j], flagALLINCLUSIVE, flagEspecial, flaginvertir);
                                        console.log(leyendaDESCBRIEF);
                                        let jsoncarga = await generaJSON(unicoscod[j], ccespecial, 'DESCBRIEF', fechasinicio[0], fechasfin[0], leyendaDESCBRIEF);
                                        carga.push(jsoncarga);
                                        if (ccespecial.includes('CU')) {
                                            jsoncarga = await generaJSON(unicoscod[j], ccespecial, 'DESCBRIEF', fechasinicio[0], fechasfin[0], leyendaDESCBRIEF, 'PEG', 'PEGASUS');
                                            carga.push(jsoncarga);
                                        }
                                        console.log(leyendaADDINFO);
                                        jsoncarga = await generaJSON(unicoscod[j], ccespecial, 'ADDINFO', fechasinicio[0], fechasfin[0], leyendaADDINFO);
                                        carga.push(jsoncarga);
                                    } else {
                                        console.log('HA OCURRIDO UN ERROR EN LA GENERACIÓN DE LEYENDA ADDINFO PARA CUENTAS SEPARADAS');
                                        flagerror = true;
                                        falla = falla + 'El Hotel ' + unicoshot[j] + '(' + unicoscod[j] + ')  no posee datos para la generación de leyenda ADDINFO\n';
                                        break;
                                    }
                                }
                            } else {
                                marca = await obtenerMarcaLocal(unicoscod[j]);
                                leyendaADDINFO = await generarLeyendaADDINFOlocal(marca, flagEspecial, flagBKFST);
                                if (leyendaADDINFO) {
                                    leyendaDESCBRIEF = await cortarLeyendaDESCBRIEF(valorlocal || valorcorp, habitacionleyenda, precioleyenda, desayunoleyenda, flagBKFST, flagdolar, flaglocal, flagcorp, descripciones, unicoshot[j], flagALLINCLUSIVE, flagEspecial, flaginvertir);
                                    console.log(leyendaDESCBRIEF);
                                    let jsoncarga = await generaJSON(unicoscod[j], contrato, 'DESCBRIEF', fechasinicio[0], fechasfin[0], leyendaDESCBRIEF);
                                    carga.push(jsoncarga);
                                    if (contrato.includes('CU')) {
                                        jsoncarga = await generaJSON(unicoscod[j], contrato, 'DESCBRIEF', fechasinicio[0], fechasfin[0], leyendaDESCBRIEF, 'PEG', 'PEGASUS');
                                        carga.push(jsoncarga);
                                    }
                                    console.log(leyendaADDINFO);
                                    jsoncarga = await generaJSON(unicoscod[j], contrato, 'ADDINFO', fechasinicio[0], fechasfin[0], leyendaADDINFO);
                                    carga.push(jsoncarga);
                                    if (ccespecial != 'NO') {
                                        marca = await obtenerMarcaCorp(unicoscod[j]);
                                        leyendaADDINFO = await generarLeyendaADDINFOcorp(marca, flagEspecial, flagBKFST);
                                        if (leyendaADDINFO) {
                                            leyendaDESCBRIEF = await cortarLeyendaDESCBRIEF(valorlocal || valorcorp, habitacionleyenda, precioleyenda, desayunoleyenda, flagBKFST, flagdolar, flaglocal, flagcorp, descripciones, unicoshot[j], flagALLINCLUSIVE.flagEspecial, flaginvertir);
                                            console.log(leyendaDESCBRIEF);
                                            let jsoncarga = await generaJSON(unicoscod[j], ccespecial, 'DESCBRIEF', fechasinicio[0], fechasfin[0], leyendaDESCBRIEF);
                                            carga.push(jsoncarga);
                                            if (ccespecial.includes('CU')) {
                                                jsoncarga = await generaJSON(unicoscod[j], ccespecial, 'DESCBRIEF', fechasinicio[0], fechasfin[0], leyendaDESCBRIEF, 'PEG', 'PEGASUS');
                                                carga.push(jsoncarga);
                                            }
                                            console.log(leyendaADDINFO);
                                            jsoncarga = await generaJSON(unicoscod[j], ccespecial, 'ADDINFO', fechasinicio[0], fechasfin[0], leyendaADDINFO);
                                            carga.push(jsoncarga);
                                        } else {
                                            console.log('HA OCURRIDO UN ERROR EN LA GENERACIÓN DE LEYENDA ADDINFO PARA CUENTAS SEPARADAS');
                                            flagerror = true;
                                            falla = falla + 'El Hotel ' + unicoshot[j] + '(' + unicoscod[j] + ')  no posee datos para la generación de leyenda ADDINFO\n';
                                            break;
                                        }
                                    }
                                } else {
                                    console.log('HA OCURRIDO UN ERROR EN LA GENERACIÓN DE LEYENDA ADDINFO PARA CUENTAS SEPARADAS');
                                    flagerror = true;
                                    falla = falla + 'El Hotel ' + unicoshot[j] + '(' + unicoscod[j] + ')  no posee datos para la generación de leyenda ADDINFO\n';
                                    break;
                                }
                            }
                        } else {
                            //Cuentas compartidas (Se generan DOS pares de leyendas)
                            if (cuentas.length != 0) {
                                for (let i = 0; i < cuentas.length; i++) {
                                    if (valorlocal) {
                                        marca = await obtenerMarcaLocal(unicoscod[j]);
                                        leyendaADDINFO = await generarLeyendaADDINFOlocal(marca, flagEspecial, flagBKFST);
                                    } else if (i == 0) {
                                        marca = await obtenerMarcaCorp(unicoscod[j]);
                                        leyendaADDINFO = await generarLeyendaADDINFOcorp(marca, flagEspecial, flagBKFST);
                                    } else {
                                        if (rfpsEspecialcc.flag) {
                                            let especial = await obtenerRFPSESPECIAL(cc[i], unicoscod[j], contrato);
                                            if (especial.flagencontrado && !especial.flagomitir && !especial.vacio && false) {
                                                leyendaADDINFO = especial.carga.Description;
                                            } else {
                                                marca = await obtenerMarcaLocal(unicoscod[j]);
                                                leyendaADDINFO = await generarLeyendaADDINFOlocal(marca, flagEspecial, flagBKFST);
                                            }
                                        } else {
                                            marca = await obtenerMarcaLocal(unicoscod[j]);
                                            leyendaADDINFO = await generarLeyendaADDINFOlocal(marca, flagEspecial, flagBKFST);
                                        }
                                    }
                                    if (leyendaADDINFO) {
                                        leyendaDESCBRIEF = await cortarLeyendaDESCBRIEF(cuentas[i], habitacionleyenda, precioleyenda, desayunoleyenda, flagBKFST, flagdolar, flaglocal, flagcorp, descripciones, unicoshot[j], flagALLINCLUSIVE, flagEspecial, flaginvertir);
                                        console.log(leyendaDESCBRIEF);
                                        let jsoncarga = await generaJSON(unicoscod[j], cc[i], 'DESCBRIEF', fechasinicio[0], fechasfin[0], leyendaDESCBRIEF);
                                        carga.push(jsoncarga);
                                        if (cc[i].includes('CU')) {
                                            jsoncarga = await generaJSON(unicoscod[j], cc[i], 'DESCBRIEF', fechasinicio[0], fechasfin[0], leyendaDESCBRIEF, 'PEG', 'PEGASUS');
                                            carga.push(jsoncarga);
                                        }
                                        console.log(leyendaADDINFO);
                                        jsoncarga = await generaJSON(unicoscod[j], cc[i], 'ADDINFO', fechasinicio[0], fechasfin[0], leyendaADDINFO);
                                        carga.push(jsoncarga);
                                    } else {
                                        console.log('Ha ocurrido un error, un campo para la generación de la leyenda ADDINFO no se encuentra disponible');
                                        falla = falla + 'El Hotel ' + unicoshot[j] + '(' + unicoscod[j] + ') no posee datos para la generación de leyenda ADDINFO\n';
                                        flagerror = true;
                                        break;
                                    }
                                }
                                if (flagerror) break;
                            } else {
                                //Cuenta separada (se genera un par de leyendas)
                                if (valorlocal) {
                                    marca = await obtenerMarcaLocal(unicoscod[j]);
                                    leyendaADDINFO = await generarLeyendaADDINFOlocal(marca, flagEspecial, flagBKFST);
                                } else {
                                    marca = await obtenerMarcaCorp(unicoscod[j]);
                                    leyendaADDINFO = await generarLeyendaADDINFOcorp(marca, flagEspecial, flagBKFST);
                                }
                                if (leyendaADDINFO) {
                                    leyendaDESCBRIEF = await cortarLeyendaDESCBRIEF(valorlocal || valorcorp, habitacionleyenda, precioleyenda, desayunoleyenda, flagBKFST, flagdolar, flaglocal, flagcorp, descripciones, unicoshot[j], flagALLINCLUSIVE, flagEspecial, flaginvertir);
                                    console.log(leyendaDESCBRIEF);
                                    let jsoncarga = await generaJSON(unicoscod[j], contrato, 'DESCBRIEF', fechasinicio[0], fechasfin[0], leyendaDESCBRIEF);
                                    carga.push(jsoncarga);
                                    if (contrato.includes('CU')) {
                                        jsoncarga = await generaJSON(unicoscod[j], contrato, 'DESCBRIEF', fechasinicio[0], fechasfin[0], leyendaDESCBRIEF, 'PEG', 'PEGASUS');
                                        carga.push(jsoncarga);
                                    }
                                    console.log(leyendaADDINFO);
                                    jsoncarga = await generaJSON(unicoscod[j], contrato, 'ADDINFO', fechasinicio[0], fechasfin[0], leyendaADDINFO);
                                    carga.push(jsoncarga);
                                } else {
                                    console.log('HA OCURRIDO UN ERROR EN LA GENERACIÓN DE LEYENDA ADDINFO PARA CUENTAS SEPARADAS');
                                    flagerror = true;
                                    falla = falla + 'El Hotel ' + unicoshot[j] + '(' + unicoscod[j] + ')  no posee datos para la generación de leyenda ADDINFO\n';
                                    break;
                                }
                            }
                        }
                    }
                } else if (flagmultiples) {
                    if (!leyendasceldas.error) {
                        if (leyendasceldas.leyendas.length > 0) carga = carga.concat(leyendasceldas.leyendas);
                        else console.log('No se encontraron habitaciones compatibles de manera individual');
                        if (leyendasceldas.ceros) {
                            console.log('entro a 677 leyendasceldas.ceros', leyendasceldas.ceros)
                            console.log('No se generaron una o varias leyendas, existen precios de tarifas muy bajas');
                            avisocero = avisocero + '\nEl Hotel ' + unicoshot[j] + '(' + unicoscod[j] + ') posee datos de tarifas muy bajas, favor de revisar.';
                            contadorceros++;
                        }
                    } else {
                        console.log('Ha ocurrido un error, un campo para la generación de la leyenda ADDINFO no se encuentra disponible');
                        falla = 'El Hotel ' + unicoshot[j] + '(' + unicoscod[j] + ') no posee datos para la generación de leyenda ADDINFO';
                        flagerror = true;
                        break;
                    }
                } else if (flagcero) {
                    console.log('entro a 688 flagcero true')
                    console.log('No se generó leyenda, existen precios de tarifas muy bajas');
                    avisocero = avisocero + '\nEl Hotel ' + unicoshot[j] + '(' + unicoscod[j] + ') posee datos de tarifas muy bajas, favor de revisar.';
                } else if (flagomitir) {
                    console.log('No se generó leyenda, la vigencia expiró');
                    avisoexpirada = avisoexpirada + '\nEl Hotel ' + unicoshot[j] + '(' + unicoscod[j] + ') posee fechas de vigencia expiradas';
                } else if (flagDecimal) {
                    console.log('No se generó leyenda, el hotel contiene tarifas en decimales');
                    avisoDec = avisoDec + '\nEl Hotel ' + unicoshot[j] + '(' + unicoscod[j] + ') contiene tarifas en decimales';
                } else {
                    console.log('No se encontraron habitaciones compatibles para la generación de leyendas, continuando...');
                    avisohab = avisohab + '\nEl Hotel ' + unicoshot[j] + '(' + unicoscod[j] + ') no posee habitaciones aplicables para la generación de leyendas';
                }
            }
            //FIN FOR
            if (!flagerror) {
                if (carga.length <= 1) {
                    console.log('¡El RPA analizó el archivo de la tarea: ' + taskname + ' y detectó una anomalía!');
                    console.log('No se generaron leyendas para este archivo');
                    console.log('Notificar al enviaCorreo soporte.convenios@posadas.com');
                    let stringmail = '¡El RPA analizó el archivo de la tarea: ' + taskname + ' con número de contrato: ' + contrato + ' y detectó una anomalía!\n';
                    if (contadorceros != 0) {
                        console.log(avisocero);
                        stringmail = stringmail + avisocero + '\n';
                    }
                    if (contadoromitefechas != 0) {
                        console.log(avisoexpirada);
                        stringmail = stringmail + avisoexpirada + '\n';
                    }
                    if (contadorhab != 0) {
                        console.log(avisohab);
                        stringmail = stringmail + avisohab + '\n';
                    }
                    if (contadorDec != 0) {
                        console.log(avisoDec);
                        stringmail = stringmail + avisoDec + '\n';
                    }
                    stringmail = stringmail + 'Favor de revisar\n';
                    objresp.archivo = '';
                    objresp.resultado = false;
                    objresp.bodyGDL = stringmail;
                    objresp.numleyendas = carga.length;
                    objresp.contrato = contrato;
                    objresp.numsol = numsol;
                    objresp.cuenta = valorlocal || valorcorp || 'NO';
                } else {
                    console.log('-----------PARA PLANCHAR EN PLANTILLA DE HMP---------------');
                    //console.log(carga)
                    logger.info('++++++TODO LO DE CARGA PARA LA LGENERACION DE LEYENDA+++++++');
                    logger.info(carga);

                    //carga= carga.replace('Â','A');
                    let nombrearchivo = await plancharPlantilla(carga, valorlocal || valorcorp);
                    if (nombrearchivo) {
                        console.log('Plantilla generada');
                        let stringmail = 'Se ha generado el archivo de la tarea: ' + taskname + ' con número de contrato: ' + contrato + '\n';
                        if (contadorceros == 0 && contadoromitefechas == 0 && contadorhab == 0 && contadorDec == 0) {
                            stringmail = stringmail + 'No se encontraron datos incorrectos.';
                        } else {
                            stringmail = stringmail + 'Observaciones:\n';
                        }
                        if (contadorceros != 0) {
                            console.log('¡El RPA analizó el archivo de la tarea: ' + taskname + ' y detectó una anomalía!');
                            stringmail = stringmail + '\n' + avisocero;
                            console.log(avisocero);
                            console.log('Notificar al enviaCorreo soporte.convenios@posadas.com');
                        }
                        if (contadoromitefechas != 0) {
                            console.log('¡El RPA analizó el archivo de la tarea: ' + taskname + ' y detectó una anomalía!');
                            stringmail = stringmail + '\n' + avisoexpirada;
                            console.log(avisoexpirada);
                            console.log('Notificar al enviaCorreo soporte.convenios@posadas.com');
                        }
                        if (contadorhab != 0) {
                            console.log('¡El RPA analizó el archivo de la tarea: ' + taskname + ' y detectó una anomalía!');
                            stringmail = stringmail + '\n' + avisohab;
                            console.log(avisohab);
                            console.log('Notificar al enviaCorreo soporte.convenios@posadas.com');
                        }
                        if (contadorDec != 0) {
                            console.log('¡El RPA analizó el archivo de la tarea: ' + taskname + ' y detectó una anomalía!');
                            stringmail = stringmail + '\n' + avisoDec;
                            console.log(avisoDec);
                            console.log('Notificar al enviaCorreo soporte.convenios@posadas.com');
                        }
                        objresp.archivo = nombrearchivo;
                        objresp.resultado = true;
                        objresp.bodyGDL = stringmail;
                        objresp.numleyendas = carga.length;
                        objresp.contrato = contrato;
                        objresp.numsol = numsol;
                        objresp.cuenta = valorlocal || valorcorp || 'NO';
                    } else {
                        let stringmail = '¡La tarea: ' + taskname + ' con número de contrato: ' + contrato + ' no pudo ser completada por el robot!\n' + 'Hubo un error generando la plantilla de carga para el HMP\n';
                        console.log('¡La tarea: ' + taskname + ' no pudo ser completada por el robot!');
                        console.log('Hubo un error generando la plantilla de carga para el HMP');
                        console.log('Notificar al enviaCorreo soporte.convenios@posadas.com');
                        objresp.archivo = '';
                        objresp.resultado = false;
                        objresp.bodyGDL = stringmail;
                        objresp.numleyendas = 0;
                        objresp.contrato = contrato;
                        objresp.numsol = numsol;
                        objresp.cuenta = valorlocal || valorcorp || 'NO';
                    }
                }
            } else {
                let stringmail = '¡La tarea: ' + taskname + ' con número de contrato: ' + contrato + ' no pudo ser completada por el robot!\n' + 'No se pudo encontrar un dato para la generación de la leyenda ADDINFO\n' + falla + '\n';
                console.log('¡La tarea: ' + taskname + ' no pudo ser completada por el robot!');
                console.log('No se pudo encontrar un dato para la generación de la leyenda ADDINFO');
                console.log(falla);
                console.log('Notificar al enviaCorreo soporte.convenios@posadas.com');
                objresp.archivo = '';
                objresp.resultado = false;
                objresp.bodyGDL = stringmail;
                objresp.numleyendas = 0;
                objresp.contrato = contrato;
                objresp.numsol = numsol;
                objresp.cuenta = valorlocal || valorcorp || 'NO';
            }
        } else {
            let stringmail = '¡La tarea: ' + taskname + ' no pudo ser completada por el robot!\n';
            if (flagsindesc) {
                stringmail = stringmail + "El contrato: '" + contrato + "' no contenía descripciones en el catálogo de DESCRIPCIONES ALIAS.\n" + 'Favor de revisar';
            } else {
                stringmail = stringmail + "El contrato: '" + contrato + "' no fue encontrado\n" + 'Favor de revisar';
            }
            console.log('¡La tarea: ' + taskname + ' no pudo ser completada por el robot!');
            console.log("El contrato: '" + contrato + "' no fue encontrado, notificar al enviaCorreo soporte.convenios@posadas.com");
            objresp.archivo = '';
            objresp.resultado = false;
            objresp.bodyGDL = stringmail;
            objresp.numleyendas = 0;
            objresp.contrato = contrato;
            objresp.numsol = numsol;
            objresp.cuenta = valorlocal || valorcorp || 'NO';
        }
        return objresp;
    } catch (e) {
        let stringmail = '¡La tarea: ' + taskname + ' no pudo ser completada por el robot!\n' + 'Ha ocurrido un error no tratado: ' + e;
        let objresp = {};
        objresp.archivo = '';
        objresp.resultado = false;
        objresp.bodyGDL = stringmail;
        objresp.numleyendas = 0;
        objresp.contrato = contrato;
        objresp.numsol = numsol;
        objresp.cuenta = valorlocal || valorcorp || 'NO';
        console.log(' --- ERROR ROBOT ---' + e)
        await sendXiraEmailError(e);
        await funcionesBD.insertaError(String(e).slice(0, 119), 'RPA Convenios', await funcionesBD.generaFechaSQL());
        return objresp;
    }
}

async function obtenerLeyendaCorporativo(contrato) {
    let estatusConvCorp = xlsx.readFile(path.join(process.env.ARCHIVOS_CONSULTA, process.env.FILE_EstatusConvenioCorporativo));
    let first_sheet_name = estatusConvCorp.SheetNames[1];
    let worksheet = estatusConvCorp.Sheets[first_sheet_name];
    let range = xlsx.utils.decode_range(worksheet['!ref']);
    let rowNum = range.s.r + 1;
    let cx = '';
    let leyenda = '';

    while (rowNum <= range.e.r) {
        cx = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 0 })];
        try {
            if (cx.v == contrato) {
                leyenda = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 6 })];
                break;
            }
            rowNum++;
        } catch (e) {
            return undefined;
        }
    }
    try {
        if (leyenda.v != '#N/D') return leyenda.v;
        else return undefined;
    } catch (e) {
        return undefined;
    }
}

async function checkEspecial(contrato) {
    let estatusConvCorp = xlsx.readFile(path.join(process.env.ARCHIVOS_CONSULTA, process.env.FILE_EstatusConvenioCorporativo));
    let first_sheet_name = estatusConvCorp.SheetNames[1];
    let worksheet = estatusConvCorp.Sheets[first_sheet_name];
    let range = xlsx.utils.decode_range(worksheet['!ref']);
    let rowNum = range.s.r + 1;
    let cx = '';
    let especial = '';
    return false;
    // while (rowNum <= range.e.r) {
    //     cx = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 2 })];
    //     try {
    //         if (cx.v == contrato) {
    //             especial = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 6 })];
    //             break;
    //         }
    //         rowNum++;
    //     } catch (e) {
    //         return false;
    //     }
    // }
    // try {
    //     if (especial.v != '') return true;
    //     else return false;
    // } catch (e) {
    //     return false;
    // }
}

async function obtenerLeyendaLocal(contrato) {
    let descripcionesAlias = xlsx.readFile(path.join(process.env.ARCHIVOS_CONSULTA, process.env.FILE_DescripcionesAlias));
    let first_sheet_name = descripcionesAlias.SheetNames[0];
    let worksheet = descripcionesAlias.Sheets[first_sheet_name];
    let range = xlsx.utils.decode_range(worksheet['!ref']);
    let rowNum = range.s.r;
    let cx = '';
    let leyenda = '';
    while (rowNum <= range.e.r) {
        cx = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 1 })];
        try {
            if (cx.v == contrato) {
                leyenda = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 2 })];
                break;
            }
            rowNum++;
        } catch (e) {
            console.log('Error obtener leyenda local:', e)
            logger.info('Error obtener leyenda local:', e)
            return undefined;
        }
    }
    try {
        return leyenda.v;
    } catch (e) {
        console.log('error en return leyenda.v', e)
        return undefined;
    }
}

async function obtenerDescripciones(contrato) {
    let descripcionesAlias = xlsx.readFile(path.join(process.env.ARCHIVOS_CONSULTA, process.env.FILE_DescripcionesAlias));
    let first_sheet_name = descripcionesAlias.SheetNames[0];
    let worksheet = descripcionesAlias.Sheets[first_sheet_name];
    let range = xlsx.utils.decode_range(worksheet['!ref']);
    let rowNum = range.s.r;
    let cx = '';
    let leyendas = [];
    let leyendalarga = '';
    let leyendamed = '';
    let leyendacorta = '';
    while (rowNum <= range.e.r) {
        cx = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 1 })];
        try {
            if (cx.v == contrato) {
                leyendalarga = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 2 })].v;
                leyendamed = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 3 })].v;
                leyendacorta = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 4 })].v;
                leyendas.push(leyendalarga);
                leyendas.push(leyendamed);
                leyendas.push(leyendacorta);
                break;
            }
            rowNum++;
        } catch (e) {

            return [];
        }
    }
    try {
        console.log('+++++++++++++++ leyenda creando push+++' + leyendas)
        return leyendas;
    } catch (e) {
        return [];
    }
}

async function consigueArregloHabitaciones() {
    let wb = xlsx.readFile(path.join(process.env.ARCHIVOS_CONSULTA, process.env.FILE_CatalogoHabitaciones));
    let first_sheet_name = wb.SheetNames[0];
    let worksheet = wb.Sheets[first_sheet_name];
    let range = xlsx.utils.decode_range(worksheet['!ref']);
    let codigosarchivo = [];
    for (let rowNum = 4; rowNum <= range.e.r; rowNum++) {
        let codigo = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 2 })];
        if (codigo) {
            if (!codigosarchivo.includes(codigo.v)) codigosarchivo.push(codigo.v);
        }
    }
    return codigosarchivo;
}

//Con base al archivo de catalogo de habitaciones, se busca el tipo de habitación y su leyenda correspondiente
async function obtenerLeyendaHabitacion(stringhab, hotel) {
    stringhab = stringhab.toString().toUpperCase();
    let wb = xlsx.readFile(path.join(process.env.ARCHIVOS_CONSULTA, process.env.FILE_CatalogoHabitaciones));
    let first_sheet_name = wb.SheetNames[0];
    let worksheet = wb.Sheets[first_sheet_name];
    let range = xlsx.utils.decode_range(worksheet['!ref']);
    let codigox = '';
    let hab = '';
    for (let rowNum = 4; rowNum <= range.e.r; rowNum++) {
        let a = [];
        hab = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 1 })];
        let codigo = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 2 })];
        if (hab && codigo) {
            a = hab.v.split('/');
            if (a.includes(stringhab)) {
                codigox = codigo.v;
                break;
            }
        }
    }
    if (codigox == '') return 'NO APLICA';
    else {
        rowNum = 0;
        while (rowNum <= range.e.r) {
            let indicadorinstruccion = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 0 })];
            let restriccion = '';
            //Columna vacía
            if (indicadorinstruccion) {
                //Columna de instrucción
                if (indicadorinstruccion.v.includes('!')) {
                    //Restricción de hotel y habitación
                    restriccion = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 1 })].v;
                    //Si es del hotel en cuestión
                    if (restriccion.includes(hotel)) {
                        if (restriccion.includes(stringhab)) {
                            return codigox;
                        } else {
                            return 'NO APLICA';
                        }
                    }
                }
            }
            rowNum++;
        }
    }
    return codigox;
}

//Obtener cuenta compartida
async function obtenerCuentaCompartidaCorporativo(contrato) {
    let estatusConvCorp = xlsx.readFile(path.join(process.env.ARCHIVOS_CONSULTA, process.env.FILE_EstatusConvenioCorporativo));
    let first_sheet_name = estatusConvCorp.SheetNames[1];
    let worksheet = estatusConvCorp.Sheets[first_sheet_name];
    let range = xlsx.utils.decode_range(worksheet['!ref']);
    let rowNum = range.s.r + 1;
    let cx = '';
    let cuentacompartida = '';

    while (rowNum <= range.e.r) {
        cx = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 0 })];
        try {
            if (cx.v == contrato) {
                cuentacompartida = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 4 })];
                break;
            }
            rowNum++;
        } catch (e) {
            return undefined;
        }
    }
    try {
        if (cuentacompartida.v != 'NO' && cuentacompartida.v != 'N/A' && cuentacompartida.v != '') return cuentacompartida.v;
        else return undefined;
    } catch (e) {
        return undefined;
    }
}

async function generaNumeros(longitud) {
    let arreglo = [];
    let contador = longitud;
    while (contador != 0) {
        arreglo.push(longitud - contador);
        contador--;
    }
    return arreglo;
}

//Con base al tipo de habitación, le asignamos un valor de ponderación
async function ponderarHabitaciones(arreglohab) {
    let arreglo = [];
    let h = await consigueArregloHabitaciones();
    let ponderacion = await generaNumeros(h.length);
    for (let i = 0; i < arreglohab.length; i++) {
        let n = (element) => element == arreglohab[i];
        let valor = h.findIndex(n);
        arreglo.push(ponderacion[valor]);
    }
    return arreglo;
}

//Obtenemos las habitaciones con el menor número de ponderación
async function obtenerMenoresTiposHab(arreglohab) {
    let arreglo = [];
    let arreglo2 = [];
    let h = await consigueArregloHabitaciones();
    let ponderacion = await generaNumeros(h.length);
    let ponderados = await ponderarHabitaciones(arreglohab);
    function comparar(a, b) {
        return a - b;
    }
    ponderados.sort(comparar);
    let first = Number.MAX_VALUE;
    let second = Number.MAX_VALUE;
    if (ponderados.length != 1) {
        for (let i = 0; i < ponderados.length; i++) {
            if (ponderados[i] < first) {
                second = first;
                first = ponderados[i];
            } else if (ponderados[i] < second && ponderados[i] != first) second = ponderados[i];
        }
        arreglo.push(first);
        if (second != Number.MAX_VALUE) arreglo.push(second);
        else arreglo.push(first);
    } else {
        arreglo.push(ponderados[0]);
    }
    for (let i = 0; i < arreglo.length; i++) {
        let n = (element) => element == arreglo[i];
        let valor = ponderacion.findIndex(n);
        arreglo2.push(h[valor]);
    }
    return arreglo2;
}

async function obtenerNumeroOcurrencias(array, value) {
    return await array.filter((v) => v === value).length;
}

async function recortarGMT(datestring) {
    let j = String(datestring);
    let prueba = j.split('/');
    if (prueba.length > 1) return j;

    let hora = j.slice(16, 18);
    if (new Number(hora) == 18) {
        let event = new Date(datestring);
        let strfecha = event.toLocaleString('en-GB', { timeZone: 'UTC' });
        let arraytmp = strfecha.split(',');
        let nuevafecha = arraytmp[0];
        arraytmp = nuevafecha.split('/');
        if (arraytmp[0].length == 1) arraytmp[0] = '0' + arraytmp[0];
        if (arraytmp[1].length == 1) arraytmp[1] = '0' + arraytmp[1];
        arraytmp[2] = arraytmp[2].slice(2, 4);
        if (arraytmp[1] > 12) {
            return arraytmp[1] + '/' + arraytmp[0] + '/' + arraytmp[2];
        } else {
            return arraytmp[0] + '/' + arraytmp[1] + '/' + arraytmp[2];
        }
    }

    let a = j.slice(4, 15);
    let espacios = a.split(' ');
    if (espacios[1].length == 1) {
        espacios[1] = '0' + espacios[1];
    }

    espacios[0] = espacios[0].toUpperCase();
    switch (espacios[0]) {
        case 'JAN':
            espacios[0] = '01';
            break;
        case 'FEB':
            espacios[0] = '02';
            break;
        case 'MAR':
            espacios[0] = '03';
            break;
        case 'APR':
            espacios[0] = '04';
            break;
        case 'MAY':
            espacios[0] = '05';
            break;
        case 'JUN':
            espacios[0] = '06';
            break;
        case 'JUL':
            espacios[0] = '07';
            break;
        case 'AUG':
            espacios[0] = '08';
            break;
        case 'SEP':
            espacios[0] = '09';
            break;
        case 'OCT':
            espacios[0] = '10';
            break;
        case 'NOV':
            espacios[0] = '11';
            break;
        case 'DEC':
            espacios[0] = '12';
            break;
    }
    let final = '';
    if (espacios[1] < 12) final = espacios[0] + '/' + espacios[1] + '/' + espacios[2];
    else final = espacios[1] + '/' + espacios[0] + '/' + espacios[2];
    return final;
}

/*
ORDEN DE RECORTE
1) REEMPLAZAR BREAKFAST POR BKFST
2) REMOVER ESPACIOS POSIBLES
3) REMOVER UNA LETRA DE MXN
4) REMOVER BKFST POR COMPLETO
5) REMOVER MXN POR COMPLETO
6) REMOVER UNA LETRA DE HABITACION
*/
async function cortarLeyendaDESCBRIEF(valor, habitacionleyenda, precioleyendax, desayunoleyendax, flagBKFST, flagdolar, flaglocal, flagcorp, descripciones, unicoshot, flagALLINCLUSIVE, flagEspecial, flaginvertir) {
    let leyendaDESCBRIEF = valor;
    let aux = '';
    console.log('inicio cortarLeyendaDESCRIEF 1213', leyendaDESCBRIEF)

    if (flagdolar) {
        //Si es RFPS e incluye desayuno por defecto en la etiqueta
        if ((flaglocal && flagBKFST) || (flagcorp && flagBKFST) || unicoshot.includes('1') || unicoshot.includes('FX') || unicoshot == 'FICCL') {
            let string_bkfst = 'BREAKFAST';
            aux = valor + ' ' + string_bkfst;
            if (aux.length > 30) {
                string_bkfst = 'BKFST';
                aux = valor + ' ' + string_bkfst;
                if (aux.length > 30) {
                    aux = descripciones[1] + ' BREAKFAST';
                    if (aux.length > 30) {
                        aux = descripciones[2] + ' BREAKFAST';
                        if (aux.length > 30) {
                            aux = descripciones[1] + ' BKFST';
                            if (aux.length > 30) {
                                aux = descripciones[2] + ' BKFST';
                                return aux;
                            } else {
                                return aux;
                            }
                        } else {
                            return aux;
                        }
                    } else {
                        return aux;
                    }
                } else {
                    return aux;
                }
            } else {
                return aux;
            }
        } else {
            return valor;
        }
    }
    console.log('despues de flagdolar cortarLeyendaDESCRIEF 1250', leyendaDESCBRIEF)
    //Copiamos los arreglos para evitar problemas con leyendas posteriores
    let preciosDescBrief = [...precioleyendax];
    console.log('preciosDescBrief 1253', preciosDescBrief)
    let desayunoDescBrief = [...desayunoleyendax];
    console.log('preciosDescBrief 1255', desayunoDescBrief)
    let habitacionDescBrief = [...habitacionleyenda];
    console.log('habitacionDescBrief 1257', habitacionDescBrief)
    //En caso de que haya más de dos valores en el arreglo, filtramos repetidos
    if (preciosDescBrief.length > 2) {
        preciosDescBrief = [...new Set(preciosDescBrief)];
        desayunoDescBrief = [...new Set(desayunoDescBrief)];
    }
    console.log('despuesif hay mas de dos valores cortarLeyendaDESCRIEF 1264', leyendaDESCBRIEF)
    //En caso de que no estén ordenados los precios de las habitaciones en el archivo
    if (flaginvertir && preciosDescBrief.length > 1) {
        let temp1 = preciosDescBrief[0];
        preciosDescBrief[0] = preciosDescBrief[1];
        preciosDescBrief[1] = temp1;
        let temp2 = desayunoDescBrief[0];
        desayunoDescBrief[0] = desayunoDescBrief[1];
        desayunoDescBrief[1] = temp2;
    }
    console.log('despuesif no esten ordenados cortarLeyendaDESCRIEF 1274', leyendaDESCBRIEF)
    //En caso de que el precio más económico no esté primero
    if (preciosDescBrief[0] > preciosDescBrief[1] && preciosDescBrief.length > 1) {
        let temp1 = preciosDescBrief[0];
        preciosDescBrief[0] = preciosDescBrief[1];
        preciosDescBrief[1] = temp1;
        let temp2 = desayunoDescBrief[0];
        desayunoDescBrief[0] = desayunoDescBrief[1];
        desayunoDescBrief[1] = temp2;
        let temp3 = habitacionDescBrief[0];
        habitacionDescBrief[0] = habitacionDescBrief[1];
        habitacionDescBrief[1] = temp3;
    }
    console.log('despuesif precio economico cortarLeyendaDESCRIEF 1287', leyendaDESCBRIEF)
    //Descripción larga 0 - Original
    leyendaDESCBRIEF = descripciones[0];
    if (preciosDescBrief.length == 1 || habitacionDescBrief.length == 1 || habitacionDescBrief[0] == habitacionDescBrief[1] || preciosDescBrief[0] == preciosDescBrief[1]) {
        
        if (flagALLINCLUSIVE || flagBKFST) {
            console.log('en if 1290 cortarLeyendaDESCRIEF 1295', leyendaDESCBRIEF, 'dato de desayuno', desayunoDescBrief[0])
            leyendaDESCBRIEF = leyendaDESCBRIEF; // Se comenta el precio o tarifa + + '/' + String(desayunoDescBrief[0]);
            console.log('en if 1294 cortarLeyendaDESCRIEF 1297', leyendaDESCBRIEF)
        }
        console.log('en if 1290 cortarLeyendaDESCRIEF 1299', leyendaDESCBRIEF)
    } else {
        for (let i = 0; i < 2; i++) {
            leyendaDESCBRIEF = leyendaDESCBRIEF + ' ' + habitacionDescBrief[i]; // Se comenta el precio o tarifa + ' ' + String(preciosDescBrief[i]);
            
        }
    }
    leyendaDESCBRIEF = leyendaDESCBRIEF;//  + ' MXN';se comenta quitar moneda
    console.log('preciosDescBrief 1302', leyendaDESCBRIEF)
    if ((flaglocal && flagBKFST) || unicoshot.includes('1') || unicoshot.includes('FX') || unicoshot == 'FICCL' || (flagcorp && flagBKFST)) {
        leyendaDESCBRIEF = leyendaDESCBRIEF + ' BREAKFAST';
    }
    //1 REEMPLAZAR BREAKFAST POR BKFST
    if (leyendaDESCBRIEF.length > 30) {
        leyendaDESCBRIEF = descripciones[0];
        if (preciosDescBrief.length == 1 || habitacionDescBrief.length == 1 || habitacionDescBrief[0] == habitacionDescBrief[1] || preciosDescBrief[0] == preciosDescBrief[1]) {
            leyendaDESCBRIEF = leyendaDESCBRIEF; // Se comenta el precio o tarifa + ' ' + String(preciosDescBrief[0]);
            
        } else {
            for (let i = 0; i < 2; i++) {
                leyendaDESCBRIEF = leyendaDESCBRIEF + ' ' + habitacionDescBrief[i];// ; // Se comenta el precio o tarifa + ' ' + String(preciosDescBrief[i]);
                
            }
        }
        leyendaDESCBRIEF = leyendaDESCBRIEF; // + ' MXN';Se comento para quitar la moneda
        if ((flaglocal && flagBKFST) || unicoshot.includes('1') || unicoshot.includes('FX') || unicoshot == 'FICCL' || (flagcorp && flagBKFST)) {
            leyendaDESCBRIEF = leyendaDESCBRIEF + ' BKFST';
        }
    }
    console.log('preciosDescBrief 1337', leyendaDESCBRIEF)
    //2 QUITAR ESPACIOS POSIBLES
    if (leyendaDESCBRIEF.length > 30) {
        leyendaDESCBRIEF = descripciones[0];
        if (preciosDescBrief.length == 1 || habitacionDescBrief.length == 1 || habitacionDescBrief[0] == habitacionDescBrief[1] || preciosDescBrief[0] == preciosDescBrief[1]) {
            leyendaDESCBRIEF = leyendaDESCBRIEF; // Se comenta el precio o tarifa + ' ' + String(preciosDescBrief[0]);
            
        } else {
            for (let i = 0; i < 2; i++) {
                leyendaDESCBRIEF = leyendaDESCBRIEF + ' ' + habitacionDescBrief[i]; // Se comenta el precio o tarifa + String(preciosDescBrief[i]);
                
            }
        }
        leyendaDESCBRIEF = leyendaDESCBRIEF; // + 'MXN';Se comento para quitar la moneda
        if ((flaglocal && flagBKFST) || unicoshot.includes('1') || unicoshot.includes('FX') || unicoshot == 'FICCL' || (flagcorp && flagBKFST)) {
            leyendaDESCBRIEF = leyendaDESCBRIEF + ' BKFST';
        }
    }
    //3 QUITAR UNA LETRA DE MXN
    if (leyendaDESCBRIEF.length > 30) {
        leyendaDESCBRIEF = descripciones[0];
        if (preciosDescBrief.length == 1 || habitacionDescBrief.length == 1 || habitacionDescBrief[0] == habitacionDescBrief[1] || preciosDescBrief[0] == preciosDescBrief[1]) {
            leyendaDESCBRIEF = leyendaDESCBRIEF; // Se comenta el precio o tarifa + ' ' + String(preciosDescBrief[0]);
           
        } else {
            for (let i = 0; i < 2; i++) {
                leyendaDESCBRIEF = leyendaDESCBRIEF + ' ' + habitacionDescBrief[i]; // Se comenta el precio o tarifa + String(preciosDescBrief[i]);
                
            }
        }
        //leyendaDESCBRIEF = leyendaDESCBRIEF + 'MX'; // Se comenta la moneda + 'MX';
        if ((flaglocal && flagBKFST) || unicoshot.includes('1') || unicoshot.includes('FX') || unicoshot == 'FICCL' || (flagcorp && flagBKFST)) {
            leyendaDESCBRIEF = leyendaDESCBRIEF + ' BKFST';
        }
    }
    console.log('preciosDescBrief 1370', leyendaDESCBRIEF)
    //4 QUITAR BKFST POR COMPLETO
    if (leyendaDESCBRIEF.length > 30) {
        leyendaDESCBRIEF = descripciones[0];
        if (preciosDescBrief.length == 1 || habitacionDescBrief.length == 1 || habitacionDescBrief[0] == habitacionDescBrief[1] || preciosDescBrief[0] == preciosDescBrief[1]) {
            leyendaDESCBRIEF = leyendaDESCBRIEF; // Se comenta el precio o tarifa + ' ' + String(preciosDescBrief[0]);
           
        } else {
            for (let i = 0; i < 2; i++) {
                leyendaDESCBRIEF = leyendaDESCBRIEF + ' ' + habitacionDescBrief[i]; // Se comenta el precio o tarifa + String(preciosDescBrief[i]);
                
            }
        }
        leyendaDESCBRIEF = leyendaDESCBRIEF; // Se comenta la moneda + 'MX';
    }
    //5 QUITAR MXN POR COMPLETO
    if (leyendaDESCBRIEF.length > 30) {
        leyendaDESCBRIEF = descripciones[0];
        if (preciosDescBrief.length == 1 || habitacionDescBrief.length == 1 || habitacionDescBrief[0] == habitacionDescBrief[1] || preciosDescBrief[0] == preciosDescBrief[1]) {
            leyendaDESCBRIEF = leyendaDESCBRIEF; // Se comenta el precio o tarifa + ' ' + String(preciosDescBrief[0]);
            
        } else {
            for (let i = 0; i < 2; i++) {
                leyendaDESCBRIEF = leyendaDESCBRIEF + ' ' + habitacionDescBrief[i]; // Se comenta el precio o tarifa + String(preciosDescBrief[i]);
                
            }
        }
    }
    console.log('preciosDescBrief 1402', leyendaDESCBRIEF)
    //6 QUITAR UNA LETRA DE HABITACIÓN
    if (leyendaDESCBRIEF.length > 30) {
        leyendaDESCBRIEF = descripciones[0];
        if (preciosDescBrief.length == 1 || habitacionDescBrief.length == 1 || habitacionDescBrief[0] == habitacionDescBrief[1] || preciosDescBrief[0] == preciosDescBrief[1]) {
            leyendaDESCBRIEF = leyendaDESCBRIEF; // Se comenta el precio o tarifa + ' ' + String(preciosDescBrief[0]);
            
        } else {
            for (let i = 0; i < 2; i++) {
                leyendaDESCBRIEF = leyendaDESCBRIEF + ' ' + habitacionDescBrief[i].slice(0, 2); // Se comenta el precio o tarifa + String(preciosDescBrief[i]);
                
            }
        }
    }
    //Descripción Mediana 0 -Descripción Original
    if (leyendaDESCBRIEF.length > 30) {
        console.log('leyendaDESCRIEF', leyendaDESCBRIEF);
        leyendaDESCBRIEF = descripciones[1];
        console.log('leyendaDESCRIEF CAMBIO ', leyendaDESCBRIEF);
        if (preciosDescBrief.length == 1 || habitacionDescBrief.length == 1 || habitacionDescBrief[0] == habitacionDescBrief[1] || preciosDescBrief[0] == preciosDescBrief[1]) {
            leyendaDESCBRIEF = leyendaDESCBRIEF; // Se comenta el precio o tarifa + ' ' + String(preciosDescBrief[0]);
            
        } else {
            for (let i = 0; i < 2; i++) {
                leyendaDESCBRIEF = leyendaDESCBRIEF + ' ' + habitacionDescBrief[i]; // Se comenta el precio o tarifa + ' ' + String(preciosDescBrief[i]);
                
            }
        }
        leyendaDESCBRIEF = leyendaDESCBRIEF; // + ' MXN'; Se comento para quitar la moneda
        if ((flaglocal && flagBKFST) || unicoshot.includes('1') || unicoshot.includes('FX') || unicoshot == 'FICCL' || (flagcorp && flagBKFST)) {
            leyendaDESCBRIEF = leyendaDESCBRIEF + ' BREAKFAST';
        }
    }
    //1 REEMPLAZAR BREAKFAST POR BKFST
    if (leyendaDESCBRIEF.length > 30) {
        leyendaDESCBRIEF = descripciones[1];
        if (preciosDescBrief.length == 1 || habitacionDescBrief.length == 1 || habitacionDescBrief[0] == habitacionDescBrief[1] || preciosDescBrief[0] == preciosDescBrief[1]) {
            leyendaDESCBRIEF = leyendaDESCBRIEF; // Se comenta el precio o tarifa + ' ' + String(preciosDescBrief[0]);
            
        } else {
            for (let i = 0; i < 2; i++) {
                leyendaDESCBRIEF = leyendaDESCBRIEF + ' ' + habitacionDescBrief[i]; // Se comenta el precio o tarifa + ' ' + String(preciosDescBrief[i]);
                
            }
        }
        leyendaDESCBRIEF = leyendaDESCBRIEF; // + ' MXN'; // Se comento para quitar MXN 
        if ((flaglocal && flagBKFST) || unicoshot.includes('1') || unicoshot.includes('FX') || unicoshot == 'FICCL' || (flagcorp && flagBKFST)) {
            leyendaDESCBRIEF = leyendaDESCBRIEF + ' BKFST';
        }
    }
    console.log('preciosDescBrief 1468', leyendaDESCBRIEF)
    //2 QUITAR ESPACIOS POSIBLES
    if (leyendaDESCBRIEF.length > 30) {
        leyendaDESCBRIEF = descripciones[1];
        if (preciosDescBrief.length == 1 || habitacionDescBrief.length == 1 || habitacionDescBrief[0] == habitacionDescBrief[1] || preciosDescBrief[0] == preciosDescBrief[1]) {
            leyendaDESCBRIEF = leyendaDESCBRIEF; // Se comenta el precio o tarifa + ' ' + String(preciosDescBrief[0]);
            
        } else {
            for (let i = 0; i < 2; i++) {
                leyendaDESCBRIEF = leyendaDESCBRIEF + ' ' + habitacionDescBrief[i]; // Se comenta el precio o tarifa + String(preciosDescBrief[i]);
                
            }
        }
        leyendaDESCBRIEF = leyendaDESCBRIEF; // + 'MXN'; Se comento para quitar la moneda
        if ((flaglocal && flagBKFST) || unicoshot.includes('1') || unicoshot.includes('FX') || unicoshot == 'FICCL' || (flagcorp && flagBKFST)) {
            leyendaDESCBRIEF = leyendaDESCBRIEF + ' BKFST';
        }
    }
    //3 QUITAR UNA LETRA DE MXN
    if (leyendaDESCBRIEF.length > 30) {
        leyendaDESCBRIEF = descripciones[1];
        if (preciosDescBrief.length == 1 || habitacionDescBrief.length == 1 || habitacionDescBrief[0] == habitacionDescBrief[1] || preciosDescBrief[0] == preciosDescBrief[1]) {
            leyendaDESCBRIEF = leyendaDESCBRIEF; // Se comenta el precio o tarifa + ' ' + String(preciosDescBrief[0]);
            
        } else {
            for (let i = 0; i < 2; i++) {
                leyendaDESCBRIEF = leyendaDESCBRIEF; // Se comenta el precio o tarifa + ' ' + habitacionDescBrief[i] + String(preciosDescBrief[i]);
                
            }
        }
        leyendaDESCBRIEF = leyendaDESCBRIEF; //+ 'MX'; Se comento para quitar la moneda
        if ((flaglocal && flagBKFST) || unicoshot.includes('1') || unicoshot.includes('FX') || unicoshot == 'FICCL' || (flagcorp && flagBKFST)) {
            leyendaDESCBRIEF = leyendaDESCBRIEF + ' BKFST';
        }
    }
    console.log('preciosDescBrief 1511', leyendaDESCBRIEF)
    //4 QUITAR BKFST POR COMPLETO
    if (leyendaDESCBRIEF.length > 30) {
        leyendaDESCBRIEF = descripciones[1];
        if (preciosDescBrief.length == 1 || habitacionDescBrief.length == 1 || habitacionDescBrief[0] == habitacionDescBrief[1] || preciosDescBrief[0] == preciosDescBrief[1]) {
            leyendaDESCBRIEF = leyendaDESCBRIEF; // Se comenta el precio o tarifa + ' ' + String(preciosDescBrief[0]);
           
        } else {
            for (let i = 0; i < 2; i++) {
                leyendaDESCBRIEF = leyendaDESCBRIEF + ' ' + habitacionDescBrief[i]; // Se comenta el precio o tarifa + String(preciosDescBrief[i]);
               
            }
        }
        leyendaDESCBRIEF = leyendaDESCBRIEF;// + 'MX'; Se comento para quitar la moneda
    }
    //5 QUITAR MXN POR COMPLETO
    if (leyendaDESCBRIEF.length > 30) {
        leyendaDESCBRIEF = descripciones[1];
        if (preciosDescBrief.length == 1 || habitacionDescBrief.length == 1 || habitacionDescBrief[0] == habitacionDescBrief[1] || preciosDescBrief[0] == preciosDescBrief[1]) {
            leyendaDESCBRIEF = leyendaDESCBRIEF; // Se comenta el precio o tarifa + ' ' + String(preciosDescBrief[0]);
            
        } else {
            for (let i = 0; i < 2; i++) {
                leyendaDESCBRIEF = leyendaDESCBRIEF; // Se comenta el precio o tarifa + ' ' + habitacionDescBrief[i] + String(preciosDescBrief[i]);
                
            }
        }
    }
    console.log('preciosDescBrief 1547', leyendaDESCBRIEF)
    //6 QUITAR UNA LETRA DE HABITACIÓN
    if (leyendaDESCBRIEF.length > 30) {
        leyendaDESCBRIEF = descripciones[1];
        if (preciosDescBrief.length == 1 || habitacionDescBrief.length == 1 || habitacionDescBrief[0] == habitacionDescBrief[1] || preciosDescBrief[0] == preciosDescBrief[1]) {
            leyendaDESCBRIEF = leyendaDESCBRIEF; // Se comenta el precio o tarifa + ' ' + String(preciosDescBrief[0]);
            
        } else {
            for (let i = 0; i < 2; i++) {
                leyendaDESCBRIEF = leyendaDESCBRIEF + ' ' + habitacionDescBrief[i].slice(0, 2); // Se comenta el precio o tarifa + String(preciosDescBrief[i]);
                
            }
        }
    }
    //Descripción Corta 0 - ORIGINAL
    if (leyendaDESCBRIEF.length > 30) {
        leyendaDESCBRIEF = descripciones[2];
        if (preciosDescBrief.length == 1 || habitacionDescBrief.length == 1 || habitacionDescBrief[0] == habitacionDescBrief[1] || preciosDescBrief[0] == preciosDescBrief[1]) {
            leyendaDESCBRIEF = leyendaDESCBRIEF; // Se comenta el precio o tarifa + ' ' + String(preciosDescBrief[0]);
            
        } else {
            for (let i = 0; i < 2; i++) {
                leyendaDESCBRIEF = leyendaDESCBRIEF + ' ' + habitacionDescBrief[i]; // Se comenta el precio o tarifa + ' ' + String(preciosDescBrief[i]);
                
            }
        }
        leyendaDESCBRIEF = leyendaDESCBRIEF; // + ' MXN'; Se comento para quitar la moneda
        if ((flaglocal && flagBKFST) || unicoshot.includes('1') || unicoshot.includes('FX') || unicoshot == 'FICCL' || (flagcorp && flagBKFST)) {
            leyendaDESCBRIEF = leyendaDESCBRIEF + ' BREAKFAST';
        }
    }
    console.log('preciosDescBrief 1586', leyendaDESCBRIEF)
    //1 REEMPLAZAR BREAKFAST POR BKFST
    if (leyendaDESCBRIEF.length > 30) {
        leyendaDESCBRIEF = descripciones[2];
        if (preciosDescBrief.length == 1 || habitacionDescBrief.length == 1 || habitacionDescBrief[0] == habitacionDescBrief[1] || preciosDescBrief[0] == preciosDescBrief[1]) {
            leyendaDESCBRIEF = leyendaDESCBRIEF; // Se comenta el precio o tarifa + ' ' + String(preciosDescBrief[0]);
            
        } else {
            for (let i = 0; i < 2; i++) {
                leyendaDESCBRIEF = leyendaDESCBRIEF + ' ' + habitacionDescBrief[i]; // Se comenta el precio o tarifa + ' ' + String(preciosDescBrief[i]);
                
            }
        }
        leyendaDESCBRIEF = leyendaDESCBRIEF; // + ' MXN'; Se comento para quitar la moneda
        if ((flaglocal && flagBKFST) || unicoshot.includes('1') || unicoshot.includes('FX') || unicoshot == 'FICCL' || (flagcorp && flagBKFST)) {
            leyendaDESCBRIEF = leyendaDESCBRIEF + ' BKFST';
        }
    }
    //2 QUITAR ESPACIOS POSIBLES
    if (leyendaDESCBRIEF.length > 30) {
        leyendaDESCBRIEF = descripciones[2];
        if (preciosDescBrief.length == 1 || habitacionDescBrief.length == 1 || habitacionDescBrief[0] == habitacionDescBrief[1] || preciosDescBrief[0] == preciosDescBrief[1]) {
            leyendaDESCBRIEF = leyendaDESCBRIEF; // Se comenta el precio o tarifa + ' ' + String(preciosDescBrief[0]);
            
        } else {
            for (let i = 0; i < 2; i++) {
                leyendaDESCBRIEF = leyendaDESCBRIEF + ' ' + habitacionDescBrief[i]; // Se comenta el precio o tarifa + String(preciosDescBrief[i]);
                
            }
        }
        leyendaDESCBRIEF = leyendaDESCBRIEF;// + 'MXN'; Se comento para quitar la moneda
        if ((flaglocal && flagBKFST) || unicoshot.includes('1') || unicoshot.includes('FX') || unicoshot == 'FICCL' || (flagcorp && flagBKFST)) {
            leyendaDESCBRIEF = leyendaDESCBRIEF + ' BKFST';
        }
    }
    console.log('preciosDescBrief 1629', leyendaDESCBRIEF)
    //3 QUITAR UNA LETRA DE MXN
    if (leyendaDESCBRIEF.length > 30) {
        leyendaDESCBRIEF = descripciones[2];
        if (preciosDescBrief.length == 1 || habitacionDescBrief.length == 1 || habitacionDescBrief[0] == habitacionDescBrief[1] || preciosDescBrief[0] == preciosDescBrief[1]) {
            leyendaDESCBRIEF = leyendaDESCBRIEF; // Se comenta el precio o tarifa + ' ' + String(preciosDescBrief[0]);
            
        } else {
            for (let i = 0; i < 2; i++) {
                leyendaDESCBRIEF = leyendaDESCBRIEF + ' ' + habitacionDescBrief[i]; // Se comenta el precio o tarifa + String(preciosDescBrief[i]);
                
            }
        }
        leyendaDESCBRIEF = leyendaDESCBRIEF; // + 'MX'; Se comento para quitar la moneda
        if ((flaglocal && flagBKFST) || unicoshot.includes('1') || unicoshot.includes('FX') || unicoshot == 'FICCL' || (flagcorp && flagBKFST)) {
            leyendaDESCBRIEF = leyendaDESCBRIEF + ' BKFST';
        }
    }
    //4 QUITAR BKFST POR COMPLETO
    if (leyendaDESCBRIEF.length > 30) {
        leyendaDESCBRIEF = descripciones[2];
        if (preciosDescBrief.length == 1 || habitacionDescBrief.length == 1 || habitacionDescBrief[0] == habitacionDescBrief[1] || preciosDescBrief[0] == preciosDescBrief[1]) {
            leyendaDESCBRIEF = leyendaDESCBRIEF; // Se comenta el precio o tarifa + ' ' + String(preciosDescBrief[0]);
            
        } else {
            for (let i = 0; i < 2; i++) {
                leyendaDESCBRIEF = leyendaDESCBRIEF + ' ' + habitacionDescBrief[i]; // Se comenta el precio o tarifa+ String(preciosDescBrief[i]);
               
            }
        }
        leyendaDESCBRIEF = leyendaDESCBRIEF; // + 'MX'; Se comento para quitar la moneda
    }
    console.log('preciosDescBrief 1669', leyendaDESCBRIEF)
    //5 QUITAR MXN POR COMPLETO
    if (leyendaDESCBRIEF.length > 30) {
        leyendaDESCBRIEF = descripciones[2];
        if (preciosDescBrief.length == 1 || habitacionDescBrief.length == 1 || habitacionDescBrief[0] == habitacionDescBrief[1] || preciosDescBrief[0] == preciosDescBrief[1]) {
            leyendaDESCBRIEF = leyendaDESCBRIEF; // Se comenta el precio o tarifa + ' ' + String(preciosDescBrief[0]);
            
        } else {
            for (let i = 0; i < 2; i++) {
                leyendaDESCBRIEF = leyendaDESCBRIEF; // Se comenta el precio o tarifa + ' ' + habitacionDescBrief[i] + String(preciosDescBrief[i]);
                
            }
        }
    }
    //6 QUITAR UNA LETRA DE HABITACIÓN
    if (leyendaDESCBRIEF.length > 30) {
        leyendaDESCBRIEF = descripciones[2];
        if (preciosDescBrief.length == 1 || habitacionDescBrief.length == 1 || habitacionDescBrief[0] == habitacionDescBrief[1] || preciosDescBrief[0] == preciosDescBrief[1]) {
            leyendaDESCBRIEF = leyendaDESCBRIEF; // Se comenta el precio o tarifa + ' ' + String(preciosDescBrief[0]);
            
        } else {
            for (let i = 0; i < 2; i++) {
                leyendaDESCBRIEF = leyendaDESCBRIEF + ' ' + habitacionDescBrief[i].slice(0, 2); // Se comenta el precio o tarifa + String(preciosDescBrief[i]);
                
            }
        }
    }
    console.log('preciosDescBrief 1704', leyendaDESCBRIEF)
    //7 QUITAR 2 LETRAS (CASO IMPROBABLE?)
    if (leyendaDESCBRIEF.length > 30) {
        leyendaDESCBRIEF = descripciones[2];
        if (preciosDescBrief.length == 1 || habitacionDescBrief.length == 1 || habitacionDescBrief[0] == habitacionDescBrief[1] || preciosDescBrief[0] == preciosDescBrief[1]) {
            leyendaDESCBRIEF = leyendaDESCBRIEF; // Se comenta el precio o tarifa + ' ' + String(preciosDescBrief[0]);
            
        } else {
            for (let i = 0; i < 2; i++) {
                leyendaDESCBRIEF = leyendaDESCBRIEF + ' ' + habitacionDescBrief[i].slice(0, 1); // Se comenta el precio o tarifa + String(preciosDescBrief[i]);
                
            }
        }
    }
    console.log('veamos que hay dentro de leyenda script ', leyendaDESCBRIEF)
    //Quitar lo que falte
    let countr = -1;
    while (leyendaDESCBRIEF.length > 30) {
        leyendaDESCBRIEF = descripciones[2].slice(0, countr);
        if (preciosDescBrief.length == 1 || habitacionDescBrief.length == 1 || habitacionDescBrief[0] == habitacionDescBrief[1] || preciosDescBrief[0] == preciosDescBrief[1]) {
            leyendaDESCBRIEF = leyendaDESCBRIEF; // Se comenta el precio o tarifa + ' ' + String(preciosDescBrief[0]);
            
        } else {
            for (let i = 0; i < 2; i++) {
                leyendaDESCBRIEF = leyendaDESCBRIEF + ' ' + habitacionDescBrief[i].slice(0, 1); // Se comenta el precio o tarifa + String(preciosDescBrief[i]);
                
            }
        }
        countr--
    }
    //Final
    console.log('FINAL LEYENDA DESCRIPT GUARDADO', leyendaDESCBRIEF)
    return await leyendaDESCBRIEF;
}

/*
• Hotel
• Contract
• Channel (valor por default: GDSOP)
• POS (valor por default: ALL)//Cambio a GC
• Language (valor por default: EN)
• Description Type
• Promotion
• From
• To
• Description
*/
async function generaJSON(hotel, contrato, desctype, inicio, fin, leyenda, CHANNEL = 'GDSOSP', POS = 'GC') {
    if (leyenda != undefined) {
        leyenda = leyenda.replace(' ', ' ');
    }

    let json = {
        Hotel: hotel,
        Contract: contrato,
        Channel: CHANNEL,
        POS: POS,
        Language: 'EN',
        'Description Type': desctype,
        Promotion: '',
        From: inicio,
        To: fin,
        Description: leyenda,
    };
    logger.info(JSON.stringify(json))
    return json;
}

async function obtenerMarcaCorp(clave) {
    let clavesparagenerardesc = xlsx.readFile(path.join(process.env.ARCHIVOS_CONSULTA, process.env.FILE_ClavesParaGenerarDescripcion));
    let CONVENIOS_CORP = clavesparagenerardesc.SheetNames[0];
    let worksheet = clavesparagenerardesc.Sheets[CONVENIOS_CORP];
    let range = xlsx.utils.decode_range(worksheet['!ref']);
    let rowNum = range.s.r;
    let cx = '';
    let clave_r = '';
    while (rowNum <= range.e.r) {
        cx = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 1 })];
        try {
            if (cx.v == clave) {
                clave_r = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 2 })];
                break;
            }
            rowNum++;
        } catch (e) {
            return undefined;
        }
    }
    try {
        return clave_r.v;
    } catch (e) {
        return undefined;
    }
}

async function generarLeyendaADDINFOcorp(marca, flagEspecial, flagBKFST) {
    let leyendasaditionalgeneric = xlsx.readFile(path.join(process.env.ARCHIVOS_CONSULTA, process.env.FILE_LeyendasAddiotionalGeneric));
    let CONVENIOS_CORP = leyendasaditionalgeneric.SheetNames[0];
    let worksheet = leyendasaditionalgeneric.Sheets[CONVENIOS_CORP];
    let cx = '';
    let leyenda = '';
    let rownum = 0;
    let range = xlsx.utils.decode_range(worksheet['!ref']);
    if (flagBKFST) {
        rowNum = 2;
        //Navegamos hasta que encontremos el indicador de desayuno
        while (rowNum <= range.e.r) {
            cx = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 1 })];
            if (cx) {
                if (cx.v.includes('CUANDO APLIQUE DESAYUNO')) break;
            }
            rowNum++;
        }
        rowNum++; //Avanzamos al siguiente renglón
        while (rowNum <= range.e.r) {
            cx = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 0 })];
            try {
                if (cx.v.toString().toUpperCase() == marca || marca.includes(cx.v.toString().toUpperCase())) {
                    leyenda = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 1 })];
                    break;
                }
                rowNum++;
            } catch (e) {
                return undefined;
            }
        }
        try {
            return leyenda.v;
        } catch (e) {
            return undefined;
        }
    } else {
        rowNum = 1;
        cx = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 0 })];
        while (cx != undefined && rowNum <= range.e.r) {
            cx = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 0 })];
            try {
                if (cx.v.toString().toUpperCase() == marca) {
                    leyenda = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 1 })];
                    break;
                }
                rowNum++;
            } catch (e) {
                return undefined;
            }
        }
        try {
            return await leyenda.v;
        } catch (e) {
            return undefined;
        }
    }
}

async function generarLeyendaADDINFOlocal(marca, flagEspecial, flagBKFST) {
    let leyendasaditionalgeneric = xlsx.readFile(path.join(process.env.ARCHIVOS_CONSULTA, process.env.FILE_LeyendasAddiotionalGeneric));
    let RFPS = leyendasaditionalgeneric.SheetNames[1];
    let worksheet = leyendasaditionalgeneric.Sheets[RFPS];
    let cx = '';
    let leyenda = '';
    let rownum = 0;
    let range = xlsx.utils.decode_range(worksheet['!ref']);
    if (flagBKFST) {
        rowNum = 2;
        while (rowNum <= range.e.r) {
            cx = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 0 })];
            if (cx) {
                if (cx.v.includes('BUFFET')) break;
            }
            rowNum++;
        }
        while (rowNum <= range.e.r) {
            cx = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 1 })];
            try {
                if (cx.v.toString().toUpperCase() == marca || marca.includes(cx.v.toString().toUpperCase())) {
                    leyenda = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 2 })];
                    break;
                }
                rowNum++;
            } catch (e) {
                return undefined;
            }
        }
    } else {
        rowNum = 1;
        cx = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 1 })];
        while (cx != undefined && rowNum <= range.e.r) {
            cx = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 1 })];
            try {
                if (cx.v.toString().toUpperCase() == marca) {
                    leyenda = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 2 })];
                    break;
                }
                rowNum++;
            } catch (e) {
                return undefined;
            }
        }
    }

    try {
        return await leyenda.v;
    } catch (e) {
        return undefined;
    }
}

async function obtenerMarcaLocal(clave) {
    let clavesparagenerardesc = xlsx.readFile(path.join(process.env.ARCHIVOS_CONSULTA, process.env.FILE_ClavesParaGenerarDescripcion));
    let RFP = clavesparagenerardesc.SheetNames[1];
    let worksheet = clavesparagenerardesc.Sheets[RFP];
    let range = xlsx.utils.decode_range(worksheet['!ref']);
    let rowNum = range.s.r;
    let cx = '';
    let clave_r = '';
    while (rowNum <= range.e.r) {
        cx = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 1 })];
        try {
            if (cx.v == clave) {
                clave_r = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 2 })];
                break;
            }
            rowNum++;
        } catch (e) {
            return undefined;
        }
    }
    try {
        return await clave_r.v;
    } catch (e) {
        return undefined;
    }
}

//LEYENDAS ESPECIALES
async function checkRFPSESPECIAL(contrato) {
    let ARCHIVOLEYENDAS = xlsx.readFile(path.join(process.env.ARCHIVOS_CONSULTA, process.env.FILE_LeyendasEspeciales));
    let datos = ARCHIVOLEYENDAS.SheetNames[0];
    let worksheet = ARCHIVOLEYENDAS.Sheets[datos];
    let range = xlsx.utils.decode_range(worksheet['!ref']);
    let rowNum = 1;
    let cx = '';
    let cuentacompartida = '';
    let objresp = {};
    let flag = false;
    while (rowNum <= range.e.r) {
        cx = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 2 })];
        try {
            if (cx.v == contrato) {
                flag = true;
                cuentacompartida = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 3 })].v;
                break;
            }
            rowNum++;
        } catch (e) {
            objresp.flag = false;
            objresp.cuentacompartida = cuentacompartida;
            return objresp;
        }
    }
    if (cuentacompartida == 'NO') {
        objresp.flag = false;
        objresp.cuentacompartida = cuentacompartida;
        return objresp;
    }
    objresp.flag = flag;
    objresp.cuentacompartida = cuentacompartida;
    return objresp;
}

async function obtenerRFPSESPECIAL(contrato, hotel, cuentacompartida) {
    const files = await fs.promises.readdir(process.env.LEYENDAS_ESPECIALES);
    let objresp = {};
    let archivo = '';
    let carga = {};
    let cargaopcional = {};
    let flagomitir = false;
    for (const file of files) {
        if (file.includes(contrato)) {
            archivo = file;
            break;
        }
    }
    if (archivo == '') {
        console.log('NO SE ENCONTRÓ ARCHIVO');
        objresp.flagencontrado = false;
    } else {
        objresp.flagencontrado = true;
        let ARCHIVOLEYENDAS = xlsx.readFile(path.join(process.env.LEYENDAS_ESPECIALES, archivo));
        let datos = ARCHIVOLEYENDAS.SheetNames[0];
        let worksheet = ARCHIVOLEYENDAS.Sheets[datos];
        let range = xlsx.utils.decode_range(worksheet['!ref']);
        let rowNum = 1;
        let inicio = '';
        let final = '';
        let leyenda = '';

        while (rowNum <= range.e.r) {
            cx = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 0 })];
            try {
                if (cx.v == hotel) {
                    inicio = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 7 })].v;
                    final = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 8 })].v;
                    leyenda = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 9 })].v;
                    let hoy = await diaHoy();

                    let A_hoy = hoy.split('/');
                    let A_inicio = inicio.split('/');
                    let A_fin = final.split('/');

                    if (A_inicio[2].length == 2) {
                        A_inicio[2] = '20' + A_inicio[2];
                    }
                    if (A_fin[2].length == 2) {
                        A_fin[2] = '20' + A_fin[2];
                    }

                    let hoyDATE = new Date(A_hoy[2], A_hoy[1], A_hoy[0]);
                    let inicioDATE = new Date(A_inicio[2], A_inicio[1], A_inicio[0]);
                    let finDATE = new Date(A_fin[2], A_fin[1], A_fin[0]);

                    if (finDATE < hoyDATE) {
                        console.log('SE DETECTÓ UNA VIGENCIA EXPIRADA, SE OMITE REGISTRO');
                        flagomitir = true;
                    } else if (hoyDATE > inicioDATE) {
                        console.log('SE DETECTÓ UNA VIGENCIA QUE ESTÁ EN CURSO, ACTUALIZA A DÍA DE HOY');
                        inicio = hoy;
                    } else if (hoyDATE < inicioDATE) {
                        console.log('SE DEJA FECHA INTACTA, LA VIGENCIA NO HA COMENZADO');
                    }
                    if (!flagomitir) {
                        if (leyenda[0] == '/') {
                            leyenda = leyenda.substring(1);
                        }
                        carga = await generaJSON(hotel, contrato, 'ADDINFO', inicio, final, leyenda);
                        if (cuentacompartida != 'NO') cargaopcional = await generaJSON(hotel, cuentacompartida, 'ADDINFO', inicio, final, leyenda);
                    }
                    break;
                }
                rowNum++;
            } catch (e) {
                return false;
            }
        }
    }
    objresp.vacio = await isEmpty(carga);
    objresp.flagomitir = flagomitir;
    objresp.carga = carga;
    objresp.cargaopcional = cargaopcional;
    return objresp;
}

async function isEmpty(obj) {
    // null and undefined are "empty"
    if (obj == null) return true;

    // Assume if it has a length property with a non-zero value
    // that that property is correct.
    if (obj.length > 0) return false;
    if (obj.length === 0) return true;

    // If it isn't an object at this point
    // it is empty, but it can't be anything *but* empty
    // Is it empty?  Depends on your application.
    if (typeof obj !== 'object') return true;

    // Otherwise, does it have any properties of its own?
    // Note that this doesn't handle
    // toString and valueOf enumeration bugs in IE < 9
    for (var key in obj) {
        if (hasOwnProperty.call(obj, key)) return false;
    }

    return true;
}

//Revisa si todos los elementos de 2 arreglos son iguales
/*
a1= [1,1,1,2] 
a2 = [1,1,1,1] 
--false
a1= [2,2,2,2] 
a2 = [1,1,1,1] 
--true
*/
async function arreglosFechaIguales(arr, arr2) {
    let s = new Set(arr);
    let s2 = new Set(arr2);
    let a = s.size == 1 && s2.size == 1;
    return a;
}

//Guarda las leyendas generadas a las plantillas de carga
async function plancharPlantilla(carga, taskname) {
    taskname = taskname.replace("/", " ")
    let dia = await diaHoy();
    dia = dia.split('/');
    try {
        let rutaarchivo = path.join(process.env.PLANTILLAS_CARGA, taskname + ' ' + dia[0] + '-' + dia[1] + '-' + dia[2] + '.csv');
        if (!fs.existsSync(rutaarchivo)) {
            fs.closeSync(fs.openSync(path.join(process.env.PLANTILLAS_CARGA, taskname + ' ' + dia[0] + '-' + dia[1] + '-' + dia[2] + '.csv'), 'w'));
            fs.closeSync(fs.openSync(path.join(process.env.HISTORIAL_PLANTILLAS, taskname + ' ' + dia[0] + '-' + dia[1] + '-' + dia[2] + '.csv'), 'w'));
            const csv = new ObjectsToCsv(carga);
            csv.toDisk(path.join(path.join(process.env.PLANTILLAS_CARGA, taskname + ' ' + dia[0] + '-' + dia[1] + '-' + dia[2] + '.csv')));
            csv.toDisk(path.join(path.join(process.env.HISTORIAL_PLANTILLAS, taskname + ' ' + dia[0] + '-' + dia[1] + '-' + dia[2] + '.csv')));

            console.log('Files created: ' + taskname + ' ' + dia[0] + '-' + dia[1] + '-' + dia[2] + '.csv');
            return taskname + ' ' + dia[0] + '-' + dia[1] + '-' + dia[2] + '.csv';
        } else {
            let contador = 1;
            rutaarchivo = path.join(process.env.PLANTILLAS_CARGA, taskname + ' ' + dia[0] + '-' + dia[1] + '-' + dia[2] + '_' + String(contador) + '.csv');
            while (fs.existsSync(rutaarchivo)) {
                contador++;
                rutaarchivo = path.join(process.env.PLANTILLAS_CARGA, taskname + ' ' + dia[0] + '-' + dia[1] + '-' + dia[2] + '_' + String(contador) + '.csv');
            }
            fs.closeSync(fs.openSync(path.join(process.env.PLANTILLAS_CARGA, taskname + ' ' + dia[0] + '-' + dia[1] + '-' + dia[2] + '_' + String(contador) + '.csv'), 'w'));
            fs.closeSync(fs.openSync(path.join(process.env.HISTORIAL_PLANTILLAS, taskname + ' ' + dia[0] + '-' + dia[1] + '-' + dia[2] + '_' + String(contador) + '.csv'), 'w'));
            const csv = new ObjectsToCsv(carga);
            csv.toDisk(path.join(path.join(process.env.PLANTILLAS_CARGA, taskname + ' ' + dia[0] + '-' + dia[1] + '-' + dia[2] + '_' + String(contador) + '.csv')));
            csv.toDisk(path.join(path.join(process.env.HISTORIAL_PLANTILLAS, taskname + ' ' + dia[0] + '-' + dia[1] + '-' + dia[2] + '_' + String(contador) + '.csv')));
            console.log('Files created: ' + taskname + ' ' + dia[0] + '-' + dia[1] + '-' + dia[2] + '_' + String(contador) + '.csv');
            logger.info('Files created: ' + taskname + ' ' + dia[0] + '-' + dia[1] + '-' + dia[2] + '_' + String(contador) + '.csv');

            return taskname + ' ' + dia[0] + '-' + dia[1] + '-' + dia[2] + '_' + String(contador) + '.csv';
        }
    } catch (error) {
        return false;
        console.log(error);
    }
}
//Formato de fecha
async function dateFormatter(stringdate) {
    let mm = '';
    let dd = '';
    mm = stringdate.substring(0, 2);
    if (mm.includes('/')) {
        stringdate = '0' + stringdate;
        dd = stringdate.substring(3, 5);
        if (dd.includes('/')) stringdate = stringdate.substring(0, 3) + '0' + stringdate.substring(3, 8);
    } else {
        dd = stringdate.substring(3, 5);
        if (dd.includes('/')) stringdate = stringdate.substring(0, 3) + '0' + stringdate.substring(3, 8);
    }
    stringdate = stringdate.substring(3, 5) + '/' + stringdate.substring(0, 3) + stringdate.substring(6, 8);
    return stringdate;
}

/*
let c1="CU0040- 1USA001"
let c2="CU0040-1USA001"
let c2_5="1USA001-CU0040"
let c3="CU0040 - 1USA001"
let c4="CU0040 -1USA001"
devuelve arreglo de cuentas
*/
async function separador(string) {
    let orig = string;
    if (string.length > 7) {
        string = string.split(' ');
        if (string.length == 1) {
            string = orig.split('-');
        } else {
            for (let i = 0; i < string.length; i++) {
                if (string[i].includes('-')) string[i] = string[i].replace('-', '');
            }
            if (string.length == 3) {
                string.splice(1, 1);
            }
        }
    }
    return string;
}

async function rangoValido(precios, moneda, codhotel) {
    //let listaprecios = xlsx.readFile(path.join(process.env.ARCHIVOS_CONSULTA, process.env.FILE_PreciosValidos));
    let first_sheet_name = listaprecios.SheetNames[0];
    console.log('fir_sheet_name', first_sheet_name);
    let worksheet = listaprecios.Sheets[first_sheet_name];
    let range = xlsx.utils.decode_range(worksheet['!ref']);
    let rowNum = 1;
    let rangodolares = 1;
    let rangopesos = 1;
    let flagindividual = false;
    let precio1 = '';
    let moneda1 = '';
    let precio2 = '';
    let moneda2 = '';
    let flag = true;
    let flagencontrado = false;
    let objresp = {};
    while (rowNum <= range.e.r) {
        cx = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 0 })].v;
        try {
            if (cx == codhotel) {
                let cx2 = worksheet[xlsx.utils.encode_cell({ r: rowNum + 1, c: 0 })];
                flagencontrado = true;
                if (cx2) {
                    if (cx == cx2.v) {
                        moneda1 = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 3 })].v;
                        precio1 = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 4 })].v;
                        moneda2 = worksheet[xlsx.utils.encode_cell({ r: rowNum + 1, c: 3 })].v;
                        precio2 = worksheet[xlsx.utils.encode_cell({ r: rowNum + 1, c: 4 })].v;
                    } else {
                        flagindividual = true;
                        moneda1 = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 3 })].v;
                        precio1 = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 4 })].v;
                    }
                } else {
                    flagindividual = true;
                    moneda1 = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 3 })].v;
                    precio1 = worksheet[xlsx.utils.encode_cell({ r: rowNum, c: 4 })].v;
                }
                break;
            }
            rowNum++;
        } catch (e) {
            console.log(e);
            objresp.encontrado = false;
            objresp.valido = false;
            objresp.error = true;
            return objresp;
        }
    }
    if (flagencontrado) {
        try {
            for (let i = 0; i < precios.length; i++) {
                if (moneda[i] == 'MXN') {
                    if (!flagindividual) {
                        let comparar = moneda1;
                        if (comparar == 'MXN') rangopesos = precio1;
                        else rangopesos = precio2;
                        if (precios[i] < rangopesos) {
                            flag = false;
                            break;
                        }
                    } else {
                        let comparar = moneda1;
                        if (comparar == 'MXN') {
                            rangopesos = precio1;
                            if (precios[i] < rangopesos) {
                                flag = false;
                                break;
                            }
                        }
                    }
                } else {
                    if (!flagindividual) {
                        let comparar = moneda1;
                        if (comparar == 'USD') rangodolares = precio1;
                        else rangodolares = precio2;
                        if (precios[i] < rangodolares) {
                            flag = false;
                            break;
                        }
                    } else {
                        let comparar = moneda1;
                        if (comparar == 'USD') {
                            rangodolares = precio1;
                            if (precios[i] < rangodolares) {
                                flag = false;
                                break;
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.log(e);
            objresp.encontrado = false;
            objresp.valido = false;
            objresp.error = true;
            return objresp;
        }
        objresp.encontrado = true;
        objresp.valido = flag;
        objresp.error = false;
        return objresp;
    } else {
        objresp.encontrado = false;
        objresp.valido = false;
        objresp.error = false;
        return objresp;
    }
}

async function generaLeyendasMultiplesFechas(precios, preciosBKFST, monedas, fechasinicio, fechasfin, tiposhab, condicionesBKFST, categorias, cc, unicoscod, unicoshot, cuentas, flagEspecial, valorlocal, valorcorp, contrato, flaglocal, flagcorp, descripciones, rfpsEspecial, ccespecial, flagALLINCLUSIVE, tarifassencillasBKFST, tarifasdoblesBKFST, rfpsEspecialcc) {
    let suma = 0;
    let sumadesayuno = 0;
    let precioleyenda = [];
    let desayunoleyenda = [];
    let habitacionleyenda = [];
    let flagBKFST = false;
    let flagdolar = false;
    let leyendas = [];
    let flagcero = false;
    let marca = '';
    let leyendaDESCBRIEF = '';
    let leyendaADDINFO = '';
    let flagerror = false;
    let objresp = {};
    let contador = 0;
    let fechasunicasinicio = [];
    let fechasunicasfin = [];
    if (tiposhab.length == 0) return undefined;
    //Obtenemos los pares de leyendas
    for (let i = 0; i < fechasinicio.length; i++) {
        if (!fechasunicasinicio.includes(fechasinicio[i])) {
            fechasunicasinicio.push(fechasinicio[i]);
            fechasunicasfin.push(fechasfin[i]);
        }
    } //Por cada par de fechas único, hacemos el proceso n veces
    for (let j = 0; j < fechasunicasinicio.length; j++) {
        let fechaactualinicio = fechasunicasinicio[j];
        let fechaactualfin = fechasunicasfin[j];

        let auxPrecios = [];
        let auxTiposhab = [];
        let auxCondicionesBKFST = [];
        let auxMonedas = [];
        let auxPreciosBKFST = [];
        let auxTarifasSencillasBKFST = [];
        let auxTarifasDoblesBKFST = [];

        for (let i = 0; i < fechasinicio.length; i++) {
            if (fechaactualinicio == fechasinicio[i]) {
                auxPrecios.push(precios[i]);
                auxTiposhab.push(tiposhab[i]);
                auxCondicionesBKFST.push(condicionesBKFST[i]);
                auxMonedas.push(monedas[i]);
                auxPreciosBKFST.push(preciosBKFST[i]);
                auxTarifasSencillasBKFST.push(tarifassencillasBKFST[i]);
                auxTarifasDoblesBKFST.push(tarifasdoblesBKFST[i]);
            }
        }

        suma = 0;
        sumadesayuno = 0;
        precioleyenda = [];
        desayunoleyenda = [];
        habitacionleyenda = await obtenerMenoresTiposHab(auxTiposhab);
        flagBKFST = false;
        flagdolar = false;
        flagcero = false;
        flaginvertir = auxTiposhab.indexOf(habitacionleyenda[0]) > auxTiposhab.indexOf(habitacionleyenda[1]);
        marca = '';
        leyendaDESCBRIEF = '';
        leyendaADDINFO = '';

        let inicio = fechaactualinicio;
        let fin = fechaactualfin;
        let flagomitir = false;
        let hoy = await diaHoy();

        let A_hoy = hoy.split('/');
        let A_inicio = inicio.split('/');
        let A_fin = fin.split('/');

        if (A_inicio[2].length == 2) {
            A_inicio[2] = '20' + A_inicio[2];
        }
        if (A_fin[2].length == 2) {
            A_fin[2] = '20' + A_fin[2];
        }

        let hoyDATE = new Date(A_hoy[2], A_hoy[1], A_hoy[0]);
        let inicioDATE = new Date(A_inicio[2], A_inicio[1], A_inicio[0]);
        let finDATE = new Date(A_fin[2], A_fin[1], A_fin[0]);

        if (finDATE < hoyDATE) {
            console.log('SE DETECTÓ UNA VIGENCIA EXPIRADA, SE OMITE REGISTRO');
            flagomitir = true;
        } else if (hoyDATE > inicioDATE) {
            console.log('SE DETECTÓ UNA VIGENCIA QUE ESTÁ EN CURSO, ACTUALIZA A DÍA DE HOY');
            fechaactualinicio = hoy;
        } else if (hoyDATE < inicioDATE) {
            console.log('SE DEJA FECHA INTACTA, LA VIGENCIA NO HA COMENZADO');
        }
        if (!flagomitir) {
            habitacionleyenda = await obtenerMenoresTiposHab(auxTiposhab);
            //let objvalido = await rangoValido(auxPrecios, auxMonedas, unicoshot);
            
            if (auxPrecios.includes(0)) {
                console.log('flagcero true 2306 cambio', auxPrecios.includes(0))
                //flagcero = true;
                //contador++;
            }
            
            for (let i = 0; i < auxPrecios.length; i++) {
                if (auxCondicionesBKFST[0] == 'V') flagBKFST = true;
                if (auxMonedas[i] == 'MXN') {
                    suma = auxTarifasSencillasBKFST[i];
                    sumadesayuno = auxTarifasDoblesBKFST[i];
                    if (!precioleyenda.includes(suma) && habitacionleyenda.includes(auxTiposhab[i])) {
                        precioleyenda.push(suma);
                    }
                    if (!desayunoleyenda.includes(sumadesayuno) && habitacionleyenda.includes(auxTiposhab[i]) && (flagBKFST || flagALLINCLUSIVE)) {
                        desayunoleyenda.push(sumadesayuno);
                    }
                }
            }

            if (precioleyenda[0] == 0 || precioleyenda.length == 0) {
                flagdolar = true;
            }
            if (!flagEspecial) {
                //Cuentas compartidas (Se generan DOS pares de leyendas)
                if (cuentas.length != 0) {
                    if (!flagcero) {
                        for (let j = 0; j < cuentas.length; j++) {
                            if (valorlocal) {
                                marca = await obtenerMarcaLocal(unicoscod);
                                leyendaADDINFO = await generarLeyendaADDINFOlocal(marca, flagEspecial, flagBKFST);
                            } else if (j == 0) {
                                marca = await obtenerMarcaCorp(unicoscod);
                                leyendaADDINFO = await generarLeyendaADDINFOcorp(marca, flagEspecial, flagBKFST);
                            } else {
                                if (rfpsEspecialcc.flag) {
                                    let especial = await obtenerRFPSESPECIAL(cc[j], unicoscod, contrato);
                                    if (especial.flagencontrado && !especial.flagomitir && !especial.vacio && false) {
                                        leyendaADDINFO = especial.carga.Description;
                                    } else {
                                        marca = await obtenerMarcaLocal(unicoscod);
                                        leyendaADDINFO = await generarLeyendaADDINFOlocal(marca, flagEspecial, flagBKFST);
                                    }
                                } else {
                                    marca = await obtenerMarcaLocal(unicoscod);
                                    leyendaADDINFO = await generarLeyendaADDINFOlocal(marca, flagEspecial, flagBKFST);
                                }
                            }
                            if (leyendaADDINFO) {
                                leyendaDESCBRIEF = await cortarLeyendaDESCBRIEF(cuentas[j], habitacionleyenda, precioleyenda, desayunoleyenda, flagBKFST, flagdolar, flaglocal, flagcorp, descripciones, unicoshot, flagALLINCLUSIVE, flagEspecial, flaginvertir);
                                console.log(leyendaDESCBRIEF + '2403');
                                let jsoncarga = await generaJSON(unicoscod, cc[j], 'DESCBRIEF', fechaactualinicio, fechaactualfin, leyendaDESCBRIEF);
                                leyendas.push(jsoncarga);
                                if (cc[j].includes('CU')) {
                                    jsoncarga = await generaJSON(unicoscod, cc[j], 'DESCBRIEF', fechaactualinicio, fechaactualfin, leyendaDESCBRIEF, 'PEG', 'PEGASUS');
                                    leyendas.push(jsoncarga);
                                }
                                console.log(leyendaADDINFO + '2410');
                                jsoncarga = await generaJSON(unicoscod, cc[j], 'ADDINFO', fechaactualinicio, fechaactualfin, leyendaADDINFO);
                                leyendas.push(jsoncarga);
                            } else {
                                console.log('Ha ocurrido un error, un campo para la generación de la leyenda ADDINFO no se encuentra disponible, saltando a siguiente HOTEL');
                                flagerror = true;
                                break;
                            }
                        }
                        if (flagerror) break;
                    } else {
                        contador++;
                    }
                } else {
                    //Cuenta separada (se genera un par de leyendas)
                    if (!flagcero) {
                        if (valorlocal) {
                            marca = await obtenerMarcaLocal(unicoscod);
                            leyendaADDINFO = await generarLeyendaADDINFOlocal(marca, flagEspecial, flagBKFST);
                        } else {
                            marca = await obtenerMarcaCorp(unicoscod);
                            leyendaADDINFO = await generarLeyendaADDINFOcorp(marca, flagEspecial, flagBKFST);
                        }
                        if (leyendaADDINFO) {
                            leyendaDESCBRIEF = await cortarLeyendaDESCBRIEF(valorlocal || valorcorp, habitacionleyenda, precioleyenda, desayunoleyenda, flagBKFST, flagdolar, flaglocal, flagcorp, descripciones, unicoshot, flagALLINCLUSIVE, flagEspecial, flaginvertir);
                            console.log(leyendaDESCBRIEF + ' 2435');
                            let jsoncarga = await generaJSON(unicoscod, contrato, 'DESCBRIEF', fechaactualinicio, fechaactualfin, leyendaDESCBRIEF);
                            leyendas.push(jsoncarga);
                            if (contrato.includes('CU')) {
                                jsoncarga = await generaJSON(unicoscod, contrato, 'DESCBRIEF', fechaactualinicio, fechaactualfin, leyendaDESCBRIEF, 'PEG', 'PEGASUS');
                                leyendas.push(jsoncarga);
                            }

                            console.log(leyendaADDINFO + 2443);
                            jsoncarga = await generaJSON(unicoscod, contrato, 'ADDINFO', fechaactualinicio, fechaactualfin, leyendaADDINFO);
                            leyendas.push(jsoncarga);
                        } else {
                            console.log('HA OCURRIDO UN ERROR EN LA GENERACIÓN DE LEYENDA ADDINFO PARA CUENTAS SEPARADAS, SALTANDO A SIGUIENTE HOTEL');
                            flagerror = true;
                            break;
                        }
                    } else {
                        contador++;
                    }
                }
            } else {
                if (!flagcero) {
                    if (rfpsEspecial) {
                        let especial = await obtenerRFPSESPECIAL(contrato, unicoscod, ccespecial);
                        if (especial.flagencontrado && !especial.flagomitir && !especial.vacio && false) {
                            leyendaADDINFO = especial.carga;
                            leyendaDESCBRIEF = await cortarLeyendaDESCBRIEF(valorlocal || valorcorp, habitacionleyenda, precioleyenda, desayunoleyenda, flagBKFST, flagdolar, flaglocal, flagcorp, descripciones, unicoshot, flagALLINCLUSIVE, flagEspecial, flaginvertir);
                            console.log(leyendaDESCBRIEF);
                            let jsoncarga = await generaJSON(unicoscod, contrato, 'DESCBRIEF', fechaactualinicio, fechaactualfin, leyendaDESCBRIEF);
                            leyendas.push(jsoncarga);
                            if (contrato.includes('CU')) {
                                jsoncarga = await generaJSON(unicoscod, contrato, 'DESCBRIEF', fechaactualinicio, fechaactualfin, leyendaDESCBRIEF, 'PEG', 'PEGASUS');
                                leyendas.push(jsoncarga);
                            }
                            console.log(leyendaADDINFO.leyenda);
                            leyendas.push(leyendaADDINFO + '2470');
                            if (ccespecial != 'NO') {
                                marca = await obtenerMarcaCorp(unicoscod);
                                leyendaADDINFO = await generarLeyendaADDINFOcorp(marca, flagEspecial, flagBKFST);
                                if (leyendaADDINFO) {
                                    leyendaDESCBRIEF = await cortarLeyendaDESCBRIEF(valorlocal || valorcorp, habitacionleyenda, precioleyenda, desayunoleyenda, flagBKFST, flagdolar, flaglocal, flagcorp, descripciones, unicoshot, flagALLINCLUSIVE, flagEspecial, flaginvertir);
                                    console.log(leyendaDESCBRIEF + 2476);
                                    let jsoncarga = await generaJSON(unicoscod, ccespecial, 'DESCBRIEF', fechaactualinicio, fechaactualfin, leyendaDESCBRIEF);
                                    leyendas.push(jsoncarga);
                                    if (ccespecial.includes('CU')) {
                                        jsoncarga = await generaJSON(unicoscod, ccespecial, 'DESCBRIEF', fechaactualinicio, fechaactualfin, leyendaDESCBRIEF, 'PEG', 'PEGASUS');
                                        leyendas.push(jsoncarga);
                                    }
                                    console.log(leyendaADDINFO);
                                    jsoncarga = await generaJSON(unicoscod, ccespecial, 'ADDINFO', fechaactualinicio, fechaactualfin, leyendaADDINFO);
                                    leyendas.push(jsoncarga);
                                } else {
                                    console.log('HA OCURRIDO UN ERROR EN LA GENERACIÓN DE LEYENDA ADDINFO PARA CUENTAS SEPARADAS');
                                    flagerror = true;
                                    falla = falla + 'El Hotel ' + unicoshot + '(' + unicoscod + ')  no posee datos para la generación de leyenda ADDINFO\n';
                                    break;
                                }
                            }
                        } else {
                            marca = await obtenerMarcaLocal(unicoscod);
                            leyendaADDINFO = await generarLeyendaADDINFOlocal(marca, flagEspecial, flagBKFST);
                            if (leyendaADDINFO) {
                                leyendaDESCBRIEF = await cortarLeyendaDESCBRIEF(valorlocal || valorcorp, habitacionleyenda, precioleyenda, desayunoleyenda, flagBKFST, flagdolar, flaglocal, flagcorp, descripciones, unicoshot, flagALLINCLUSIVE, flagEspecial, flaginvertir);
                                console.log(leyendaDESCBRIEF);
                                let jsoncarga = await generaJSON(unicoscod, contrato, 'DESCBRIEF', fechaactualinicio, fechaactualfin, leyendaDESCBRIEF);
                                leyendas.push(jsoncarga);
                                if (contrato.includes('CU')) {
                                    jsoncarga = await generaJSON(unicoscod, contrato, 'DESCBRIEF', fechaactualinicio, fechaactualfin, leyendaDESCBRIEF, 'PEG', 'PEGASUS');
                                    leyendas.push(jsoncarga);
                                }
                                console.log(leyendaADDINFO);
                                jsoncarga = await generaJSON(unicoscod, contrato, 'ADDINFO', fechaactualinicio, fechaactualfin, leyendaADDINFO);
                                leyendas.push(jsoncarga);
                                if (ccespecial != 'NO') {
                                    marca = await obtenerMarcaCorp(unicoscod);
                                    leyendaADDINFO = await generarLeyendaADDINFOcorp(marca, flagEspecial, flagBKFST);
                                    if (leyendaADDINFO) {
                                        leyendaDESCBRIEF = await cortarLeyendaDESCBRIEF(valorlocal || valorcorp, habitacionleyenda, precioleyenda, desayunoleyenda, flagBKFST, flagdolar, flaglocal, flagcorp, descripciones, unicoshot, flagALLINCLUSIVE, flagEspecial, flaginvertir);
                                        console.log(leyendaDESCBRIEF);

                                        let jsoncarga = await generaJSON(unicoscod, ccespecial, 'DESCBRIEF', fechaactualinicio, fechaactualfin, leyendaDESCBRIEF);
                                        leyendas.push(jsoncarga);
                                        if (ccespecial.includes('CU')) {
                                            jsoncarga = await generaJSON(unicoscod, ccespecial, 'DESCBRIEF', fechaactualinicio, fechaactualfin, leyendaDESCBRIEF, 'PEG', 'PEGASUS');
                                            leyendas.push(jsoncarga);
                                        }
                                        console.log(leyendaADDINFO);
                                        jsoncarga = await generaJSON(unicoscod, ccespecial, 'ADDINFO', fechaactualinicio, fechaactualfin, leyendaADDINFO);
                                        leyendas.push(jsoncarga);
                                    } else {
                                        console.log('HA OCURRIDO UN ERROR EN LA GENERACIÓN DE LEYENDA ADDINFO PARA CUENTAS SEPARADAS');
                                        flagerror = true;
                                        falla = falla + 'El Hotel ' + unicoshot + '(' + unicoscod + ')  no posee datos para la generación de leyenda ADDINFO\n';
                                        break;
                                    }
                                }
                            } else {
                                console.log('HA OCURRIDO UN ERROR EN LA GENERACIÓN DE LEYENDA ADDINFO PARA CUENTAS SEPARADAS');
                                flagerror = true;
                                falla = falla + 'El Hotel ' + unicoshot + '(' + unicoscod + ')  no posee datos para la generación de leyenda ADDINFO\n';
                                break;
                            }
                        }
                    } else {
                        //Cuentas compartidas (Se generan DOS pares de leyendas)
                        if (cuentas.length != 0) {
                            for (let z = 0; z < cuentas.length; i++) {
                                if (valorlocal) {
                                    marca = await obtenerMarcaLocal(unicoscod);
                                    leyendaADDINFO = await generarLeyendaADDINFOlocal(marca, flagEspecial, flagBKFST);
                                } else if (z == 0) {
                                    marca = await obtenerMarcaCorp(unicoscod);
                                    leyendaADDINFO = await generarLeyendaADDINFOcorp(marca, flagEspecial, flagBKFST);
                                } else {
                                    if (rfpsEspecialcc.flag) {
                                        let especial = await obtenerRFPSESPECIAL(cc[z], unicoscod, contrato);
                                        if (especial.flagencontrado && !especial.flagomitir && !especial.vacio && false) {
                                            leyendaADDINFO = especial.carga.Description;
                                        } else {
                                            marca = await obtenerMarcaLocal(unicoscod);
                                            leyendaADDINFO = await generarLeyendaADDINFOlocal(marca, flagEspecial, flagBKFST);
                                        }
                                    } else {
                                        marca = await obtenerMarcaLocal(unicoscod);
                                        leyendaADDINFO = await generarLeyendaADDINFOlocal(marca, flagEspecial, flagBKFST);
                                    }
                                }
                                if (leyendaADDINFO) {
                                    leyendaDESCBRIEF = await cortarLeyendaDESCBRIEF(cuentas[z], habitacionleyenda, precioleyenda, desayunoleyenda, flagBKFST, flagdolar, flaglocal, flagcorp, descripciones, unicoshot, flagALLINCLUSIVE, flagEspecial, flaginvertir);
                                    console.log(leyendaDESCBRIEF);
                                    let jsoncarga = await generaJSON(unicoscod, cc[z], 'DESCBRIEF', fechaactualinicio, fechaactualfin, leyendaDESCBRIEF);
                                    carga.push(jsoncarga);
                                    if (cc[z].includes('CU')) {
                                        jsoncarga = await generaJSON(unicoscod, cc[z], 'DESCBRIEF', fechaactualinicio, fechaactualfin, leyendaDESCBRIEF, 'PEG', 'PEGASUS');
                                        leyendas.push(jsoncarga);
                                    }
                                    console.log(leyendaADDINFO);
                                    jsoncarga = await generaJSON(unicoscod, cc[z], 'ADDINFO', fechaactualinicio, fechaactualfin, leyendaADDINFO);
                                    leyendas.push(jsoncarga);
                                } else {
                                    console.log('Ha ocurrido un error, un campo para la generación de la leyenda ADDINFO no se encuentra disponible');
                                    falla = falla + 'El Hotel ' + unicoshot + '(' + unicoscod + ') no posee datos para la generación de leyenda ADDINFO\n';
                                    flagerror = true;
                                    break;
                                }
                            }
                            if (flagerror) break;
                        } else {
                            //Cuenta separada (se genera un par de leyendas)
                            if (valorlocal) {
                                marca = await obtenerMarcaLocal(unicoscod);
                                leyendaADDINFO = await generarLeyendaADDINFOlocal(marca, flagEspecial, flagBKFST);
                            } else {
                                marca = await obtenerMarcaCorp(unicoscod);
                                leyendaADDINFO = await generarLeyendaADDINFOcorp(marca, flagEspecial, flagBKFST);
                            }
                            if (leyendaADDINFO) {
                                leyendaDESCBRIEF = await cortarLeyendaDESCBRIEF(valorlocal || valorcorp, habitacionleyenda, precioleyenda, desayunoleyenda, flagBKFST, flagdolar, flaglocal, flagcorp, descripciones, unicoshot, flagALLINCLUSIVE, flagEspecial, flaginvertir);
                                console.log(leyendaDESCBRIEF);
                                let jsoncarga = await generaJSON(unicoscod, contrato, 'DESCBRIEF', fechaactualinicio, fechaactualfin, leyendaDESCBRIEF);
                                leyendas.push(jsoncarga);
                                if (contrato.includes('CU')) {
                                    jsoncarga = await generaJSON(unicoscod, contrato, 'DESCBRIEF', fechaactualinicio, fechaactualfin, leyendaDESCBRIEF, 'PEG', 'PEGASUS');
                                    leyendas.push(jsoncarga);
                                }
                                console.log(leyendaADDINFO);
                                jsoncarga = await generaJSON(unicoscod, contrato, 'ADDINFO', fechaactualinicio, fechaactualfin, leyendaADDINFO);
                                leyendas.push(jsoncarga);
                            } else {
                                console.log('HA OCURRIDO UN ERROR EN LA GENERACIÓN DE LEYENDA ADDINFO PARA CUENTAS SEPARADAS');
                                flagerror = true;
                                falla = falla + 'El Hotel ' + unicoshot + '(' + unicoscod + ')  no posee datos para la generación de leyenda ADDINFO\n';
                                break;
                            }
                        }
                    }
                } else {
                    contador++;
                }
            }
        }
    }

    objresp.leyendas = leyendas;
    console.log('FINAL RETURN contador', contador, 'flagerror',flagerror)
    //console.log('LEYENDAS ONB- '+   leyendas + ' -LEYENDAS')
    if (contador > 0) objresp.ceros = true;
    else objresp.ceros = false;
    if (!flagerror) objresp.error = false;
    else objresp.error = true;
    return objresp;
}

async function diaHoy() {
    let today = new Date();
    let dd = today.getDate();
    let mm = today.getMonth() + 1;
    let yyyy = today.getFullYear();
    //yyyy = String(yyyy).slice(2, 4)
    yyyy = String(yyyy);
    if (dd < 10) {
        dd = '0' + dd;
    }
    if (mm < 10) {
        mm = '0' + mm;
    }
    today = dd + '/' + mm + '/' + yyyy;

    return today;
}

async function cambiarFrameDescargaDocumento(page, config = { intentos: 10, delay: 7000, ciclo: 0 }) {
    let intentos = config.intentos ? config.intentos : 10;
    let delay = config.delay ? config.delay : 5000;
    let ciclo = config.ciclo ? config.ciclo : 0;

    if (ciclo < intentos) {
        await sleep(delay);
        await page.waitForSelector("iframe[id='wlctdc:j_id__ctru10:r1:0:tldc:taskDetailInlineFrame::f']");
        let iframe = null;
        const iframeList = page.frames();
        iframeList.map((frame) => {
            //if (/^w\d{1,5}$/.test(frame['_name'])) iframe = frame;
            if (frame['_name'] != 'afr::PushIframe' && frame['_name'] != '' && frame['_name']) iframe = frame;
        });
        if (iframe) {
            return iframe;
        } else {
            config.ciclo = ciclo + 1;
            return cambiarFrameDescargaDocumento(page, config);
        }
    } else {
        return false;
    }
}

async function cambiarFrameCargaHMP(page, config = { intentos: 10, delay: 10000, ciclo: 0 }) {
    let intentos = config.intentos ? config.intentos : 10;
    let delay = config.delay ? config.delay : 5000;
    let ciclo = config.ciclo ? config.ciclo : 0;

    if (ciclo < intentos) {
        await sleep(delay);
        await page.waitForSelector('#desc');
        let iframe = null;
        const iframeList = page.frames();
        iframeList.map((frame) => {
            if (frame['_name'] == 'desc') iframe = frame;
        });
        if (iframe) {
            return iframe;
        } else {
            config.ciclo = ciclo + 1;
            return cambiarFrameCargaHMP(page, config);
        }
    } else {
        return false;
    }
}

async function cambiarFrameProgresoHMP(page, config = { intentos: 10, delay: 5000, ciclo: 0 }) {
    let intentos = config.intentos ? config.intentos : 10;
    let delay = config.delay ? config.delay : 5000;
    let ciclo = config.ciclo ? config.ciclo : 0;

    if (ciclo < intentos) {
        await sleep(delay);
        await page.waitForSelector('#idFrmDescFileProcess');
        let iframe = null;
        const iframeList = page.frames();
        iframeList.map((frame) => {
            if (frame['_name'] == 'idFrmDescFileProcess') iframe = frame;
        });
        if (iframe) {
            return iframe;
        } else {
            config.ciclo = ciclo + 1;
            return cambiarFrameProgresoHMP(page, config);
        }
    } else {
        return false;
    }
}

 async function enviaCorreo(stringmail, cuenta, numsol) {
    if (cuenta == 'NO') {
        cuenta = '';
    }
    const mailOptions = {
        from: 'RPA GENERACIÓN DE LEYENDAS CONVENIOS <infobot@xira-intelligence.com>',
        to: process.env.LISTA_DISTRIBUCION,
        subject: 'STATUS ' + numsol + ' ' + cuenta,
        text: stringmail,
        html: '',
    };
    const transporter = nodemailer.createTransport({
        host: process.env.HOST_EMAIL,
        pool: true,
        auth: {
          user: process.env.CORREO,
          pass: process.env.PASS_MAIL,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });


    // let transporter = nodemailer.createTransport({
    //     service: 'gmail',
    //     auth: {
    //         user: 'sendermailneikos@gmail.com',
    //         pass: 'ContraPass'
    //     }
    // });

    return new Promise((resolve) => {
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log( 'No se envio el correo de status'+ error)
                logger.info( 'No se envio el correo de status'+ error)
                console.error(error);
                resolve(false);
                transporter.close();
                return;
            }

            console.log(JSON.stringify(info));
            logger.info('correo enviado',JSON.stringify(info));
            console.log('Se envia enviaCorreo a soporte.convenios@posadas.com');
            logger.info('Se envia enviaCorreo a soporte.convenios@posadas.com');
            resolve(true);
            transporter.close();
            return;
        });
    });
}
 
 async function notificaInicio(stringmail) {
    const mailOptions = {
        from: 'RPA GENERACIÓN DE LEYENDAS CONVENIOS <infobot@xira-intelligence.com>',
        to: process.env.LISTA_DISTRIBUCION,
        subject: 'NOTIFICACIÓN INICIO RPA',
        text: stringmail,
        html: '',
    };

    // let transporter = nodemailer.createTransport({
    //     service: 'gmail',
    //     auth: {
    //         user: 'sendermailneikos@gmail.com',
    //         pass: 'ContraPass'
    //     }
    // });

    const transporter = nodemailer.createTransport({
        host: process.env.HOST_EMAIL,
        pool: true,
        auth: {
          user: process.env.CORREO,
          pass: process.env.PASS_MAIL,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });

    return new Promise((resolve) => {
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error(error);
                resolve();
                transporter.close();
                return;
            }

            console.log(JSON.stringify(info));
            logger.info('envio correo',JSON.stringify(info))
            console.log('Se envia enviaCorreo a soporte.convenios@posadas.com');
            resolve();
            transporter.close();
            return;
        });
    });
    
} 

 async function sendXiraEmailError(error, config = { attachments: [] }) {
    const mailOptions = {
        from: 'RPA GENERACIÓN DE LEYENDAS CONVENIOS <soporte.xira2022@gmail.com>',
        to: 'soporte@xira.com.mx',
        subject: 'ERROR RPA ',
        text: '',
        html: `EL RPA HA PRESENTADO UN ERROR DE CONEXIÓN CON DAT:<br><br>${error.stack || error}`,
        attachments: config.attachments,
    };

    const transporter = nodemailer.createTransport({
        host: process.env.HOST_EMAIL,
        pool: true,
        auth: {
          user: process.env.EMAIL_ALERT,
          pass: process.env.PASS_ALERT,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });

    return new Promise((resolve) => {
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error(`Funcion: ${__function} - Linea: ${__line} - Error: ${error.stack || error}`);
                logger.info(`Funcion: ${__function} - Linea: ${__line} - Error: ${error.stack || error}`);
                
                resolve();
                transporter.close();
                return;
            }

            console.log(JSON.stringify(info));
            logger.info('correo enviado',JSON.stringify(info));
            console.log('Se envia enviaCorreo a soporte.convenios@posadas.com');
            resolve();
            transporter.close();
            return;
        });
    });
} 

 async function sendPosadasEmailCredentialsNotice(error, config = { attachments: [] }) {
    const mailOptions = {
        from: 'ALERTA HMP  <infobot@xira-intelligence.com>',
        to: process.env.LISTA_DISTRIBUCION,
        subject: 'HMP CREDENCIALES EXPIRADAS',
        text: '',
        html: `ERROR:<br>${error.stack || error}`,
        attachments: config.attachments,
    };

    const transporter = nodemailer.createTransport({
        host: process.env.HOST_EMAIL,
        pool:true,
        auth: {
          user: process.env.CORREO,
          pass: process.env.PASS_MAIL,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });

    return new Promise((resolve) => {
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error(`Funcion: ${__function} - Linea: ${__line} - Error: ${error.stack || error}`);
                logger.info(`Funcion: ${__function} - Linea: ${__line} - Error: ${error.stack || error}`);
                resolve();
                transporter.close();
                return;
            }

            console.log(JSON.stringify(info));
            logger.info('correo enviado',JSON.stringify(info));
            console.log('Se envia enviaCorreo a soporte.convenios@posadas.com');
            resolve();
            transporter.close();
            return;
        });
    });
} 

 async function credentialCheckHMP() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(process.env.HMP_URL, { waitUntil: 'networkidle2', timeout: 180000 });
    await page.waitForSelector("input[name='j_username']");
    await page.type("input[id='j_username']", process.env.USERHMP, { delay: 100 });
    await page.waitForSelector("input[name='j_password']");
    await page.type("input[id='j_password']", process.env.PASSHMP, { delay: 100 });
    await page.click('#signIn');

    const url = await page.url();
    if (url == process.env.HMP_LOGINEXP) {
        console.log('Las credenciales han expirado');
        const messageScreenshot = {};
        const screenshotBase64 = await page.screenshot({
            fullPage: true,
            encoding: 'base64',
        });
        messageScreenshot.content = screenshotBase64;
        messageScreenshot.filename = 'screenshot.png';
        messageScreenshot.encoding = 'base64';
        let hoysql = await funcionesBD.generaFechaSQL();
        let enviado = await funcionesBD.verificaUltimoEnvioHMP();
        if (enviado.length == 0) {
            await sendPosadasEmailCredentialsNotice('Problema al iniciar sesión en plataforma HMP, las credenciales han expirado.<br><br>', { attachments: [messageScreenshot] });
            await funcionesBD.insertaFechaEnvioHMP(hoysql);
        }
        await browser.close();
        return false;
    } else {
        console.log('Las credenciales son válidas');
        await page.waitForSelector('#header > table:nth-child(1) > tbody > tr:nth-child(1) > td:nth-child(2) > table > tbody > tr > td:nth-child(1) > a', { timeout: 180000 });
        await page.click('#header > table:nth-child(1) > tbody > tr:nth-child(1) > td:nth-child(2) > table > tbody > tr > td:nth-child(1) > a');
        await browser.close();
        return true;
    }
} 

async function cargaHMP(correctos, archivos, numLeyendas) {
    let statuscarga = [];

    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.goto(process.env.HMP_URL, { waitUntil: 'networkidle2', timeout: 180000 });
    await page.waitForSelector("input[name='j_username']");
    await page.type("input[id='j_username']", process.env.USERHMP, { delay: 100 });
    await page.waitForSelector("input[name='j_password']");
    await page.type("input[id='j_password']", process.env.PASSHMP, { delay: 100 });
    await page.click('#signIn');
    console.log('Login en HMP');
    await page.goto(process.env.HMP_CARGA, { waitUntil: 'networkidle2', timeout: 180000 });
    await sleep(10000);
    let flagarchivocorrecto = false;
    for (let i = 0; i < archivos.length; i++) {
        let objresp = {};
        console.log('Tarea ' + (i + 1));
        try {
            if (correctos[i]) {
                let numleyendasarchivo = numLeyendas[i];
                //Cambiamos al frame donde aparece el botón de descarga
                let iframe = await cambiarFrameCargaHMP(page);
                await iframe.waitForSelector('#descFileForm > table > tbody > tr > td > div > table > tbody > tr > td > div:nth-child(1) > div > div:nth-child(2) > input', { timeout: 18000 });
                await sleep(5000);
                console.log('click boton');
                console.log('A');
                const [fileChooser] = await Promise.all([
                    page.waitForFileChooser(),
                    //Se da click botón "Browse for description file"
                    await page.mouse.click(29, 120),
                    console.log('Abre filechooser'),
                ]);

                await fileChooser.accept([path.join(process.env.PLANTILLAS_CARGA, archivos[i])]);
                console.log('Se ha cargado el archivo, ejecutando botón de proceso...');

                //Se da click botón "Process File"
                await page.mouse.click(300, 120);
                await sleep(3000);

                //Se redirige a la pestaña de progreso de carga
                await page.waitForSelector('#header > table:nth-child(1) > tbody > tr:nth-child(2) > td > ul > li:nth-child(2) > a', { timeout: 18000 });
                await page.click('#header > table:nth-child(1) > tbody > tr:nth-child(2) > td > ul > li:nth-child(2) > a');
                console.log('Buscando barras de progreso');
                await sleep(5000);

                //Tabla de tareas con barras de progreso
                iframe = await cambiarFrameProgresoHMP(page);
                await sleep(10000);
                await iframe.waitForSelector("table[id='descFileProcessFrm:processDescTable:n'] > tbody > tr", { timeout: 18000 });
                const t = (await iframe.$$("table[id='descFileProcessFrm:processDescTable:n'] > tbody > tr")).length;

                let selectorDinamico = await iframe.evaluate(() => document.querySelector("table[id='descFileProcessFrm:processDescTable:n'] > tbody > tr > td").getAttribute('id'));
                selectorDinamico = selectorDinamico.replace('descFileProcessFrm:processDescTable:0:j_id_jsp_', '');
                selectorDinamico = selectorDinamico.replace('_4', '');
                console.log(selectorDinamico);

                let statusproceso = '';
                let anchor = '';
                for (let j = 0; j < t; j++) {
                    //Fila actual
                    await sleep(5000);
                    console.log('Nueva fila ' + j);
                    //tr[id='descFileProcessFrm\:processDescTable\:n\:0'] > td[id='descFileProcessFrm\:processDescTable\:0\:j_id_jsp_2132229671_13'] > div
                    //"tr[id='descFileProcessFrm\:processDescTable\:n\:0'] > td[id='descFileProcessFrm\:processDescTable\:0\:j_id_jsp_2132229671_13'] > div"
                    let selector_actual = "tr[id='descFileProcessFrm:processDescTable:n:" + j + "']";
                    await iframe.waitForSelector(selector_actual, { timeout: 18000 });

                    let element = '';

                    element = await iframe.waitForSelector(selector_actual + "> td[id='descFileProcessFrm:processDescTable:" + j + ':j_id_jsp_' + selectorDinamico + "_13'] > div", { timeout: 18000 });

                    //Buscamos título
                    let titulotareaproceso = await element.evaluate((el) => el.textContent);
                    //console.log(titulotareaproceso);

                    //console.log('Titulo tarea: ' + titulotareaproceso);

                    if (titulotareaproceso == archivos[i]) {
                        console.log('Titulo de tarea encontrado');
                        flagarchivocorrecto = true;
                        //WAIT - VALIDATING - PERSISTING - NO HA TERMINADO
                        //SUCCESS - EXITO
                        //FAIL - ERROR EN CARGA
                        //Se verifica status de proceso
                        anchor = await iframe.waitForSelector(selector_actual + "> td[id='descFileProcessFrm:processDescTable:" + j + ':j_id_jsp_' + selectorDinamico + "_19'] > div > a");
                        statusproceso = await anchor.evaluate((el) => el.textContent);

                        //Actualizar mientras el status de carga no cambie
                        console.log('Esperando a carga....');
                        do {
                            anchor = await iframe.waitForSelector(selector_actual + "> td[id='descFileProcessFrm:processDescTable:" + j + ':j_id_jsp_' + selectorDinamico + "_19'] > div > a");
                            statusproceso = await anchor.evaluate((el) => el.textContent);
                        } while (statusproceso == 'WAIT' || statusproceso == 'VALIDATING' || statusproceso == 'PERSISTING');

                        //Obtenemos el numero de leyendas cargadas
                        let nl = await iframe.waitForSelector(selector_actual + "> td[id='descFileProcessFrm:processDescTable:" + j + ':j_id_jsp_' + selectorDinamico + "_16'] > div");
                        let numleyendasDat = await nl.evaluate((el) => el.textContent);

                        //Si fue exitoso
                        if (statusproceso == 'SUCCESS') {
                            //Verificamos numero de leyendas de archivo con número de leyendas de programa
                            if (numleyendasDat != numleyendasarchivo) {
                                logger.info('Error cargando leyendas, no coincide numero de leyendas generadas con número de leyendas cargadas');
                                console.log('Error cargando leyendas, no coincide numero de leyendas generadas con número de leyendas cargadas');
                                objresp.statusCargado = false;
                                objresp.desc = 'No coincide número de leyendas generadas con número de leyendas cargadas\n' + 'Número de leyendas generadas por el robot: ' + numleyendasarchivo + '\n' + 'Número de leyendas cargadas en HMP: ' + numleyendasDat + '\n';
                                statuscarga.push(objresp);
                                await sleep(2500);
                            } else {
                                console.log('Éxito cargando leyendas, archivo preparado para liberación en DAT');
                                logger.info('Éxito cargando leyendas, archivo preparado para liberación en DAT');
                                objresp.statusCargado = true;
                                objresp.desc = 'Cargado exitoso a HMP\n' + 'Número de leyendas cargadas: ' + numleyendasDat;
                                statuscarga.push(objresp);
                                await sleep(2500);
                            }
                        } else {
                            console.log('Error cargando archivo');
                            objresp.statusCargado = false;
                            objresp.desc = 'El archivo presentó una falla y fue rechazado por el HMP';
                            statuscarga.push(objresp);
                            await sleep(2500);
                        }
                        break;
                    } else {
                        console.log('Titulo no corresponde, se sigue buscando');
                    }
                }
                if (!flagarchivocorrecto) {
                    console.log('Error cargando archivo');
                    objresp.statusCargado = false;
                    objresp.desc = 'El archivo presentó una falla y fue rechazado por el HMP';
                    statuscarga.push(objresp);
                    await sleep(2500);
                }
            } else {
                objresp.statusCargado = false;
                objresp.desc = 'No hay archivo para cargar a HMP';
                console.log('No hay archivo para cargar a HMP, se omite archivo');
                statuscarga.push(objresp);
                await sleep(2500);
            }
        } catch (error) {
            console.log('Excepción HMP: ' + error);
            objresp.statusCargado = false;
            objresp.desc = 'Ocurrió un error con la plataforma HMP';
            statuscarga.push(objresp);
            await sleep(2500);
        }

        await page.goto(process.env.HMP_CARGA, { waitUntil: 'networkidle2', timeout: 180000 });
    }

    //Cierre de sesión
    try {
        await page.waitForSelector('#header > table:nth-child(1) > tbody > tr:nth-child(1) > td:nth-child(2) > table > tbody > tr > td:nth-child(1) > a', { timeout: 180000 });
        await page.click('#header > table:nth-child(1) > tbody > tr:nth-child(1) > td:nth-child(2) > table > tbody > tr > td:nth-child(1) > a');
        await browser.close();
    } catch (e) {
        await browser.close();
    }

    console.log('Se ha concluido el proceso de carga a HMP');
    return statuscarga;
}

async function checkUpdatedFiles() {
    const files = await fs.promises.readdir(process.env.NUEVOS_ARCHIVOS);
    if (files.length > 0) {
        console.log('Hay nuevos archivos, actualizando....');
        for (const file of files) {
            let name = Date.now() + '_';
            fs.copyFileSync(path.join(process.env.ARCHIVOS_CONSULTA, file), path.join(process.env.HISTORICO, file));
            console.log('Archivo respaldado en histórico');
            fs.renameSync(path.join(process.env.HISTORICO, file), path.join(process.env.HISTORICO, name + file));
            console.log('Archivo renombrado en histórico');
            fs.copyFileSync(path.join(process.env.NUEVOS_ARCHIVOS, file), path.join(process.env.ARCHIVOS_CONSULTA, file));
            console.log('Archivo actualizado!');
            fs.unlinkSync(path.join(process.env.NUEVOS_ARCHIVOS, file));
            console.log('Archivo eliminado de folder origen!');
        }
    } else {
        console.log('No hay nuevos archivos, retomando flujo normal');
    }
}
 
async function alertaErrorLiberar(tarea, stringmail) {
     // if (cuenta == 'NO') {
        // cuenta = '';
     //} 
    const mailOptions = {
         from: 'RPA GENERACIÓN DE LEYENDAS CONVENIOS <soporte@xira.ai>',
         to: 'soporte@xira.com.mx',//process.env.CORREO,//'soporte@xira.ai',//process.env.LISTA_DISTRIBUCION,
         subject: 'Error liberación  en DAT' , //+ numsol + ' ' + cuenta,
         //text: 'Mientras se realizaba el proceso de liberación de la tarea: '+stringmail + '. hubo un error o no se pudo liberar.',
         text: stringmail+ 'Hubo un problema durante su liberación se procesara de nuevo en el siguiente bloque ',
         html: '',
     };
     //console.log('paso mailoptions')
     const transporter = nodemailer.createTransport({
         host: process.env.HOST_EMAIL,
         pool: true,
         auth: {
           user: process.env.CORREO,//process.env.CORREO,
           pass: process.env.PASS_MAIL,
         },
         tls: {
           rejectUnauthorized: false,
         },
       });
 
 
     // let transporter = nodemailer.createTransport({
     //     service: 'gmail',
     //     auth: {
     //         user: 'sendermailneikos@gmail.com',
     //         pass: 'ContraPass'
     //     }
     // });
     //console.log('paso transporte')
     return new Promise((resolve) => {
         transporter.sendMail(mailOptions, (error, info) => {
             if (error) {
                 console.log( 'No se envio el correo de error en liberación '+ error)
                 logger.info( 'No se envio el correo de error en liberación '+ error)
                 
                 //console.error(error);
                 resolve();
                 transporter.close();
                 return;
             }
 
             console.log(JSON.stringify(info));
             logger.info('correo enviado',JSON.stringify(info));
            // console.log('Se envia enviaCorreo a soporte@xira.ai');
            console.log('se envio correo')
             resolve();
             transporter.close();
             return;
         });
     });
 }
 


module.exports.alertaErrorLiberar = alertaErrorLiberar;
module.exports.checkUpdatedFiles = checkUpdatedFiles;
module.exports.cargaHMP = cargaHMP;
module.exports.enviaCorreo = enviaCorreo;
module.exports.notificaInicio = notificaInicio;
module.exports.credentialCheckHMP = credentialCheckHMP;
module.exports.sendXiraEmailError = sendXiraEmailError;
module.exports.procesoGeneracionLeyendas = procesoGeneracionLeyendas;
module.exports.cambiarFrameDescargaDocumento = cambiarFrameDescargaDocumento;
module.exports.cambiarFrameCargaHMP = cambiarFrameCargaHMP;
