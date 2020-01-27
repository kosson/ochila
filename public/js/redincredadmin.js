// TODO: Introdu mecanismul de ștergere
// #1 Culege id-ul
// #2 Trimite un event „delresid” in server::serverul șterge înregistrarea din MongoDB și din Elasticsearch și directorul de pe HDD.
// #3 serverul trimite înapoi pe același eveniment confirmarea că a șters tot și face redirectare către /profile/resurse

// #1
var resurse = document.getElementsByClassName('resursa');
var resArr = Array.from(resurse);
var dataRes = resArr[0].dataset;

// Managementul modalului
$( document ).on( "click", "#delete", function() {
    $('#exampleModal').modal('hide');
});

// detaliile resursei
var resObi = {id: dataRes.id, contribuitor: dataRes.contribuitor};

// #2
function deleteRes () {
    pubComm.emit('delresid', resObi);
    console.log('Am trimis obiectul: ', resObi);
    pubComm.on('delresid', (res) => {
        console.log(res);
    });
    window.location.href = '/profile/resurse/';
}

// #3
var resursa = document.getElementById(dataRes.id);
var validateCheckbox = document.getElementById('valid');
var publicCheckbox = document.getElementById('public');
validateCheckbox.addEventListener('click', validateResource);
publicCheckbox.addEventListener('click', setGeneralPublic);

// setează clasele în funcție de starea resursei
if (validateCheckbox.checked) {
    resursa.classList.add('validred');
} else {
    resursa.classList.add('invalidred');
}

/**
 * Funcția are rolul de listener pentru input checkbox-ul pentru validare
 * Modifică documentul în bază, declarându-l valid
 * Input checkbox-ul se formează din rute routes.js la app.get('/profile/resurse/:idres'...
 * @param {Object} evt 
 */
function validateResource (evt) {
    var queryObj = {_id: dataRes.id};
    // se va trimite valoarea true sau false, depinde ce valoarea are checkbox-ul la bifare sau debifare
    if (validateCheckbox.checked) {
        // verifică dacă există clasa 'invalidred' (resursa pornește nevalidată)
        if (resursa.classList.contains('invalidred')) {
            resursa.classList.replace('invalidred', 'validred');
        }
        queryObj.expertCheck = true;
        pubComm.emit('validateRes', queryObj);
    } else {
        if (resursa.classList.contains('validred')) {
            resursa.classList.replace('validred', 'invalidred');
        }
        queryObj.expertCheck = false;        
        pubComm.emit('validateRes', queryObj);
    }
    pubComm.on('validateRes', (response) => {
        // TODO: modifică backgroundul galben în verde pal
        if (response.expertCheck) {
            console.log('Schimb culoarea background-ului din galben în verde pal');
        } else {
            console.log('Schimb culoarea background-ului din verde pal în galben');
        }
    });
}
/**
 * Funcția are rolul de a seta o resursă ca fiind disponibilă publicului
 * @param {Object} evt 
 */
function setGeneralPublic (evt) {
    var queryObj = {_id: dataRes.id};
    // se va trimite valoarea true sau false, depinde ce valoarea are checkbox-ul la bifare sau debifare
    if (publicCheckbox.checked) {
        queryObj.generalPublic = true;
        pubComm.emit('setPubRes', queryObj);
    } else {
        queryObj.generalPublic = false;        
        pubComm.emit('setPubRes', queryObj);
    }    
    pubComm.on('setPubRes', (response) => {
        // TODO: modifică backgroundul galben în verde pal
        if (response.generalPublic) {
            console.log('Resursa a intrat în zona publică');
        } else {
            console.log('Resursa a fost retrasă din zona publică');
        }
    });
}