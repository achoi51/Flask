CREATE DATABASE Flask
USE Flask

CREATE TABLE Chemicals (
    ChemicalID int PRIMARY KEY,
    ChemicalName varchar(255),
    State varchar(255),
    MeltingPoint int
);

CREATE TABLE ChemicalReactions (
    ChemicalReactionID int PRIMARY KEY,
    InputChemical1 int NOT NULL,
    InputChemical2 int,
    InputChemical3 int,
    WrittenFormula varchar(255),
    OutputChemical1 int NOT NULL,
    OutputChemical2 int,
    OutputChemical3 int,
    FOREIGN KEY (InputChemical1) REFERENCES Chemicals(ChemicalID),
    FOREIGN KEY (InputChemical2) REFERENCES Chemicals(ChemicalID),
    FOREIGN KEY (InputChemical3) REFERENCES Chemicals(ChemicalID),
    FOREIGN KEY (OutputChemical1) REFERENCES Chemicals(ChemicalID),
    FOREIGN KEY (OutputChemical2) REFERENCES Chemicals(ChemicalID)
);

CREATE TABLE ActiveChemicals (
    ActiveChemicalID int PRIMARY Key NOT NULL AUTO_INCREMENT,
    ChemicalID int,
    XPosition float,
    YPosition float,
    FOREIGN KEY (ChemicalID) REFERENCES Chemicals(ChemicalID)
);

--Fill tables using csv files
--Current csv files are mock files

LOAD DATA INFILE 'C:/ProgramData/MySQL/MySQL Server 8.0/Uploads/Chemicals.csv'
IGNORE
INTO TABLE Chemicals
FIELDS TERMINATED BY ','
LINES TERMINATED BY '\n'
IGNORE 1 LINES;

LOAD DATA INFILE 'C:/ProgramData/MySQL/MySQL Server 8.0/Uploads/ChemicalReactions.csv'
IGNORE
INTO TABLE ChemicalReactions
FIELDS TERMINATED BY ','
LINES TERMINATED BY '\n'
IGNORE 1 LINES;

LOAD DATA INFILE 'C:/ProgramData/MySQL/MySQL Server 8.0/Uploads/ActiveChemicals.csv'
IGNORE
INTO TABLE ActiveChemicals
FIELDS TERMINATED BY ','
LINES TERMINATED BY '\n';


--When user exits website make a csv to save their 
SELECT * FROM ActiveChemicals
INTO OUTFILE 'C:/ProgramData/MySQL/MySQL Server 8.0/Uploads/ActiveChemicals.csv'
FIELDS TERMINATED BY ','
ENCLOSED BY '"'
LINES TERMINATED BY '\n';