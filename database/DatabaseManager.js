import mysql from 'mysql2'
import dotenv from 'dotenv'

dotenv.config()

const pool = mysql.createPool({
    //can't get the .env working so empty for now
    host: '',
    user: '',
    password: '',
    database: '',
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

console.log(await getChemicalReactionInput(1))
console.log(await getChemicalReactionOutput(1))