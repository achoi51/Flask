import mysql from 'mysql2'
import dotenv from 'dotenv'
import fs from 'node:fs';

dotenv.config()

const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
}).promise()

async function getChemical(name) {
    const [row] = await pool.query('SELECT * FROM Chemicals WHERE ChemicalName = ?', [name])
    return row[0]
}

async function getChemicalReaction(id) {
    const [row] = await pool.query('SELECT * FROM ChemicalReactions WHERE ChemicalReactionID = ?', [id])
    return row
}

async function getChemicalReactionInput(id) {
    const [row] = await pool.query('SELECT * FROM ChemicalReactions WHERE ChemicalReactionID = ?', [id])
    const input = new Array();
    input.push(row[0].InputChemical1);
    input.push(row[0].InputChemical2);
    input.push(row[0].InputChemical3);
    return input
}

async function getChemicalReactionOutput(id) {
    const [row] = await pool.query('SELECT * FROM ChemicalReactions WHERE ChemicalReactionID = ?', [id])
    const output = new Array();
    output.push(row[0].OutputChemical1);
    output.push(row[0].OutputChemical2);
    output.push(row[0].OutputChemical3);
    return output
}

async function pullActiveChemicalsTable() {
    await pool.query('DROP TABLE ActiveChemicals')
    await pool.query('CREATE TABLE ActiveChemicals (ActiveChemicalID int PRIMARY Key NOT NULL AUTO_INCREMENT,ChemicalID int,XPosition float,YPosition float,FOREIGN KEY (ChemicalID) REFERENCES Chemicals(ChemicalID));')
    await pool.query('LOAD DATA INFILE \'C:/ProgramData/MySQL/MySQL Server 8.0/Uploads/ActiveChemicals.csv\' IGNORE INTO TABLE ActiveChemicals FIELDS TERMINATED BY \',\' LINES TERMINATED BY \'\\n\';')

}

async function addActiveChemical(id, xPosition, yPosition) {
    const [row] = await pool.query('INSERT INTO activechemicals(ChemicalID, XPosition, YPosition) VALUES(?,?,?)', [id, xPosition, yPosition])
    return row[0].activechemicals
}

async function removeActiveChemical(id) {
    await pool.query('DELETE FROM ActiveChemicals WHERE ActiveChemicalID=? ', [id])
}

async function pushActiveChemicalsTable() {
    fs.unlink('C:/ProgramData/MySQL/MySQL Server 8.0/Uploads/ActiveChemicals.csv', (err) => {
        if (err) throw err;
        console.log('File deleted successfully');
    })
    await pool.query('SELECT * FROM ActiveChemicals INTO OUTFILE \'C:/ProgramData/MySQL/MySQL Server 8.0/Uploads/ActiveChemicals.csv\' FIELDS TERMINATED BY \',\' ENCLOSED BY \'\"\' LINES TERMINATED BY \'\\n\';')
}
