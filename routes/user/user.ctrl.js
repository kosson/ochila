const GoogleStrategy   = require('passport-google-oauth20').Strategy;
//TODO: implementează restul strategiilor!!!
const LocalStrategy    = require('passport-local').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const TwitterStrategy  = require('passport-twitter').Strategy;

module.exports = (passport) => {
    // Pentru a putea susține sesiuni de login persistent, Passport trebuie să serializeze și deserializeze obiectul `user` din sesiune
    passport.serializeUser( function clbkSerUser (user, cb) {
        cb(null, user);
    });  
    passport.deserializeUser(function clbkDeserUser (obj, cb) {
        cb(null, obj);
    });

    // Încarcă funcția care tratează autentificarea cu Google pentru strategia dedicată
    let cbGoogleStrategy = require('./helpers/googleStrategy.helper');
    // Strategia de access pentru conturile de Google
    passport.use(new GoogleStrategy({
            clientID:          process.env.GOOGLE_CLIENT_ID,
            clientSecret:      process.env.GOOGLE_CLIENT_SECRET,
            callbackURL:       process.env.BASE_URL + "/callback",
            prompt:            'select_account',
            passReqToCallback: true
        }, cbGoogleStrategy
    ));

    // returnează un obiect ale cărui metode vor fi tot atâtea middleware-uri
    return {
        auth(req, res){
            res.render('auth', {
                title:    "auth",
                style:   "/lib/fontawesome/css/fontawesome.min.css",
                logoimg:  "img/rED-logo192.png",
                credlogo: "img/CREDlogo150.jpg"
            });
        },
        login(req, res){
            res.render('login', {
                title:    "login",
                style:   "/lib/fontawesome/css/fontawesome.min.css",
                logoimg:  "img/rED-logo192.png",
                credlogo: "img/CREDlogo150.jpg"
            });
        },
        ensureAuthenticated(req, res, next){
            if(req.isAuthenticated()){
                return next();
            }
            res.redirect('/401');
        }
    };
};