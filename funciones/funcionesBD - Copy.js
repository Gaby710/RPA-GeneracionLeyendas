//funciones
let mysql = require('mysql');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
dotenv.config();
const pool = mysql.createPool({
    connectionLimit: 15,
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASS,
    database: process.env.MYSQL_DB,
});
async function conseguirTareasError() {
    let tasks = [];
    try {
        return new Promise((resolve, reject) => {
            pool.getConnection((error, connection) => {
                if (error) {
                    console.error(`Funcion: ${__function} - Linea: ${__line} - Error: ${error.stack || error}`);
                    reject([]);
                    return;
                }

                const query = `SELECT * FROM TareasError where HOUR(TIMEDIFF(NOW(), fecha_finproceso))<24;`;

                connection.query(query, (error, results) => {
                    connection.release();
                    if (error) {
                        console.error(`Funcion: ${__function} - Linea: ${__line} - Error: ${error.stack || error}`);
                        resolve([]);
                        return;
                    }
                    if (results.length > 0) {
                        results = JSON.parse(JSON.stringify(results));
                        for (let i = 0; i < results.length; i++) {
                            tasks.push(results[i].NOMBRE);
                        }
                        resolve(tasks);
                        return;
                    } else {
                        resolve([]);
                        return;
                    }
                });
            });
        });
    } catch (error) {
        console.error(error);
        return [];
    }
}

async function checkifExistsTareaDat(taskname) {
    let flag = false;
    try {
        return new Promise((resolve, reject) => {
            pool.getConnection((error, connection) => {
                if (error) {
                    console.error(`Funcion: ${__function} - Linea: ${__line} - Error: ${error.stack || error}`);
                    reject([]);
                    return;
                }

                const query = `SELECT * FROM TareasFinalizadasDAT where NOMBRE = ? ;`;

                connection.query(query, [taskname], (error, results) => {
                    connection.release();
                    if (error) {
                        console.error(`Funcion: ${__function} - Linea: ${__line} - Error: ${error.stack || error}`);
                        resolve(false);
                        return;
                    }
                    if (results.length > 0) flag = true;
                    resolve(flag);
                    return;
                });
            });
        });
    } catch (error) {
        console.error(error);
        return false;
    }
}

async function checkifExistsTareaError(taskname) {
    let flag = false;
    try {
        return new Promise((resolve, reject) => {
            pool.getConnection((error, connection) => {
                if (error) {
                    console.error(`Funcion: ${__function} - Linea: ${__line} - Error: ${error.stack || error}`);
                    reject([]);
                    return;
                }

                const query = `SELECT * FROM TareasError where NOMBRE = ? ;`;

                connection.query(query, [taskname], (error, results) => {
                    connection.release();
                    if (error) {
                        console.error(`Funcion: ${__function} - Linea: ${__line} - Error: ${error.stack || error}`);
                        resolve(false);
                        return;
                    }
                    if (results.length > 0) flag = true;
                    resolve(flag);
                    return;
                });
            });
        });
    } catch (error) {
        console.error(error);
        return false;
    }
}

async function insertaTareaErroneo(taskname, diahoy) {
    return new Promise((resolve, reject) => {
        pool.getConnection((error, connection) => {
            if (error) {
                console.error(`Funcion: ${__function} - Linea: ${__line} - Error: ${error.stack || error}`);
                resolve(0);
                return;
            }
            const query = 'INSERT INTO TareasError (NOMBRE,fecha_finproceso) VALUES (?,?)';

            connection.query(query, [taskname, diahoy], (error, results) => {
                connection.release();

                if (error) {
                    console.error(`Funcion: ${__function} - Linea: ${__line} - Error: ${error.stack || error}`);
                    resolve(0);
                    return;
                }

                resolve();
                return;
            });
        });
    });
}

async function insertaFechaEnvioHMP(diahoy) {
    return new Promise((resolve, reject) => {
        pool.getConnection((error, connection) => {
            if (error) {
                console.error(`Funcion: ${__function} - Linea: ${__line} - Error: ${error.stack || error}`);
                resolve(0);
                return;
            }
            const query = 'INSERT INTO AvisosCredencialesHMP(fechaEnvio) VALUES (?)';

            connection.query(query, [diahoy], (error, results) => {
                connection.release();

                if (error) {
                    console.error(`Funcion: ${__function} - Linea: ${__line} - Error: ${error.stack || error}`);
                    resolve(0);
                    return;
                }

                resolve();
                return;
            });
        });
    });
}

async function insertaProcesoConsorcios(NombreArchivo, NumeroLeyendas, fecha, estatus) {
    return new Promise((resolve, reject) => {
        pool.getConnection((error, connection) => {
            if (error) {
                console.error(`Funcion: ${__function} - Linea: ${__line} - Error: ${error.stack || error}`);
                resolve(0);
                return;
            }

            const query = 'INSERT INTO RegistrosConsorcios(NombreArchivo,NumeroLeyendas,fecha,estatus) VALUES (?,?,?,?)';

            connection.query(query, [NombreArchivo, NumeroLeyendas, fecha, !estatus], (error, results) => {
                connection.release();

                if (error) {
                    console.error(`Funcion: ${__function} - Linea: ${__line} - Error: ${error.stack || error}`);
                    resolve(0);
                    return;
                }

                resolve();
                return;
            });
        });
    });
}

async function insertaError(tipoerror, RPA, fecha) {
    return new Promise((resolve, reject) => {
        pool.getConnection((error, connection) => {
            if (error) {
                console.error(`Funcion: ${__function} - Linea: ${__line} - Error: ${error.stack || error}`);
                resolve(0);
                return;
            }

            const query = 'INSERT INTO Errores(TipoError,RPA,fecha) VALUES (?,?,?)';

            connection.query(query, [tipoerror, RPA, fecha], (error, results) => {
                connection.release();

                if (error) {
                    console.error(`Funcion: ${__function} - Linea: ${__line} - Error: ${error.stack || error}`);
                    resolve(0);
                    return;
                }

                resolve();
                return;
            });
        });
    });
}

async function eliminaTareaError(taskname) {
    return new Promise((resolve, reject) => {
        pool.getConnection((error, connection) => {
            if (error) {
                console.error(`Funcion: ${__function} - Linea: ${__line} - Error: ${error.stack || error}`);
                resolve(0);
                return;
            }

            const query = 'DELETE FROM TareasError WHERE NOMBRE = ?';

            connection.query(query, [taskname], (error, results) => {
                connection.release();

                if (error) {
                    console.error(`Funcion: ${__function} - Linea: ${__line} - Error: ${error.stack || error}`);
                    resolve(0);
                    return;
                }

                resolve();
                return;
            });
        });
    });
}

async function insertaProcesoTerminadoDAT(taskname, numleyendas, fechasql, estado, bodymail) {
    return new Promise((resolve, reject) => {
        pool.getConnection((error, connection) => {
            if (error) {
                console.error(`Funcion: ${__function} - Linea: ${__line} - Error: ${error.stack || error}`);
                resolve(0);
                return;
            }

            const query = 'INSERT INTO TareasFinalizadasDAT (NOMBRE,NumeroLeyendas,fecha_fin,STATUS_FIN,resultadoop) VALUES (?,?,?,?,?)';

            connection.query(query, [taskname, numleyendas, fechasql, estado, bodymail], (error, results) => {
                connection.release();

                if (error) {
                    console.error(`Funcion: ${__function} - Linea: ${__line} - Error: ${error.stack || error}`);
                    resolve(0);
                    return;
                }

                resolve();
                return;
            });
        });
    });
}

async function insertaProcesoLog(fechaInicio, fechaFin, NumeroTareasLiberadas, NumeroLeyendas, flujocompleto) {
    return new Promise((resolve, reject) => {
        pool.getConnection((error, connection) => {
            if (error) {
                console.error(`Funcion: ${__function} - Linea: ${__line} - Error: ${error.stack || error}`);
                resolve(0);
                return;
            }

            const query = 'INSERT INTO RegistrosConvenios (fechaInicio,fechaFin,NumeroTareasLiberadas,NumeroLeyendas,flujocompleto) VALUES (?,?,?,?,?)';

            connection.query(query, [fechaInicio, fechaFin, NumeroTareasLiberadas, NumeroLeyendas, flujocompleto], (error, results) => {
                connection.release();

                if (error) {
                    console.error(`Funcion: ${__function} - Linea: ${__line} - Error: ${error.stack || error}`);
                    resolve(0);
                    return;
                }

                resolve();
                return;
            });
        });
    });
}

async function actualizaProcesoTerminadoDAT(taskname, numleyendas, fechasql, estado, bodymail) {
    return new Promise((resolve, reject) => {
        pool.getConnection((error, connection) => {
            if (error) {
                console.error(`Funcion: ${__function} - Linea: ${__line} - Error: ${error.stack || error}`);
                resolve(0);
                return;
            }

            const query = 'UPDATE TareasFinalizadasDAT set NumeroLeyendas=?,fecha_fin=?,STATUS_FIN=?,resultadoop=? where NOMBRE=?;';

            connection.query(query, [numleyendas, fechasql, estado, taskname, bodymail], (error, results) => {
                connection.release();

                if (error) {
                    console.error(`Funcion: ${__function} - Linea: ${__line} - Error: ${error.stack || error}`);
                    resolve(0);
                    return;
                }

                resolve();
                return;
            });
        });
    });
}

async function actualizaTareaError(idtask, fechasql) {
    return new Promise((resolve, reject) => {
        pool.getConnection((error, connection) => {
            if (error) {
                console.error(`Funcion: ${__function} - Linea: ${__line} - Error: ${error.stack || error}`);
                resolve(0);
                return;
            }

            const query = 'UPDATE TareasError set fecha_finproceso=? where ID=?';

            connection.query(query, [fechasql, idtask], (error, results) => {
                connection.release();

                if (error) {
                    console.error(`Funcion: ${__function} - Linea: ${__line} - Error: ${error.stack || error}`);
                    resolve(0);
                    return;
                }

                resolve();
                return;
            });
        });
    });
}

async function verificaUltimoEnvioHMP() {
    let tasks = [];
    try {
        return new Promise((resolve, reject) => {
            pool.getConnection((error, connection) => {
                if (error) {
                    console.error(`Funcion: ${__function} - Linea: ${__line} - Error: ${error.stack || error}`);
                    reject([]);
                    return;
                }

                const query = `SELECT * FROM AvisosCredencialesHMP where HOUR(TIMEDIFF(NOW(), fechaEnvio))<1;`;

                connection.query(query, (error, results) => {
                    connection.release();
                    if (error) {
                        console.error(`Funcion: ${__function} - Linea: ${__line} - Error: ${error.stack || error}`);
                        resolve([]);
                        return;
                    }
                    if (results.length > 0) {
                        results = JSON.parse(JSON.stringify(results));
                        for (let i = 0; i < results.length; i++) {
                            tasks.push(results[i].fechaEnvio);
                        }
                        resolve(tasks);
                        return;
                    } else {
                        resolve([]);
                        return;
                    }
                });
            });
        });
    } catch (error) {
        console.error(error);
        return [];
    }
}

async function consultaUltimoIntentoDAT(nombreTarea) {
    let tasks = [];
    try {
        return new Promise((resolve, reject) => {
            pool.getConnection((error, connection) => {
                if (error) {
                    console.error(`Funcion: ${__function} - Linea: ${__line} - Error: ${error.stack || error}`);
                    reject([]);
                    return;
                }

                const query = `SELECT IF(HOUR(TIMEDIFF(NOW(), fecha_finproceso))<24, "WAIT", "UPDATE") AS INDICATION FROM TareasError where NOMBRE=?;`;

                connection.query(query, [nombreTarea], (error, results) => {
                    connection.release();
                    if (error) {
                        console.error(`Funcion: ${__function} - Linea: ${__line} - Error: ${error.stack || error}`);
                        resolve([]);
                        return;
                    }
                    if (results.length > 0) {
                        results = JSON.parse(JSON.stringify(results));
                        for (let i = 0; i < results.length; i++) {
                            tasks.push(results[i].INDICATION);
                        }
                        resolve(tasks);
                        return;
                    } else {
                        resolve([]);
                        return;
                    }
                });
            });
        });
    } catch (error) {
        console.error(error);
        return [];
    }
}

async function consigueIDTareaError(nombre) {
    let tasks = [];
    try {
        return new Promise((resolve, reject) => {
            pool.getConnection((error, connection) => {
                if (error) {
                    console.error(`Funcion: ${__function} - Linea: ${__line} - Error: ${error.stack || error}`);
                    reject([]);
                    return;
                }

                const query = `SELECT ID FROM TareasError where NOMBRE=?;`;

                connection.query(query, [nombre], (error, results) => {
                    connection.release();
                    if (error) {
                        console.error(`Funcion: ${__function} - Linea: ${__line} - Error: ${error.stack || error}`);
                        resolve([]);
                        return;
                    }
                    if (results.length > 0) {
                        results = JSON.parse(JSON.stringify(results));
                        for (let i = 0; i < results.length; i++) {
                            tasks.push(results[i].ID);
                        }
                        resolve(tasks[0]);
                        return;
                    } else {
                        resolve([]);
                        return;
                    }
                });
            });
        });
    } catch (error) {
        console.error(error);
        return [];
    }
}

async function generaFechaSQL() {
    var fechaSql = new Date();
    var horario = fechaSql.getTimezoneOffset() / 60;

    //fechaSql.setHours(fechaSql.getHours() - horario);
    fechaSql.setHours(fechaSql.getHours());
    return fechaSql;
}

module.exports.insertaProcesoConsorcios = insertaProcesoConsorcios;
module.exports.insertaError = insertaError;
module.exports.checkifExistsTareaError = checkifExistsTareaError;
module.exports.insertaProcesoLog = insertaProcesoLog;
module.exports.insertaFechaEnvioHMP = insertaFechaEnvioHMP;
module.exports.verificaUltimoEnvioHMP = verificaUltimoEnvioHMP;
module.exports.generaFechaSQL = generaFechaSQL;
module.exports.actualizaProcesoTerminadoDAT = actualizaProcesoTerminadoDAT;
module.exports.conseguirTareasError = conseguirTareasError;
module.exports.checkifExistsTareaDat = checkifExistsTareaDat;
module.exports.insertaTareaErroneo = insertaTareaErroneo;
module.exports.eliminaTareaError = eliminaTareaError;
module.exports.insertaProcesoTerminadoDAT = insertaProcesoTerminadoDAT;
module.exports.consultaUltimoIntentoDAT = consultaUltimoIntentoDAT;
module.exports.actualizaTareaError = actualizaTareaError;
module.exports.consigueIDTareaError = consigueIDTareaError;
