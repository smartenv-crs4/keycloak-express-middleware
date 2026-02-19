
var etag = require('etag');


function overrideEnd(req,res,callback){
    var oldEnd = res.end;
    res.end = function (chunk) {

        if(!(res.statusCode==304)){

            var header=res.getHeader('Content-Type') || "application/json; charset=utf-8";

            var body;

            if((header.indexOf('application/json')>=0)){
                try {
                    body = chunk ? JSON.parse(chunk.toString('utf8')) : {};
                }catch (ex){
                    body=chunk ? chunk.toString('utf8') : "";
                    header="text/html";
                }
            }else{
                body=chunk ? chunk.toString('utf8') : "";
            }

            callback(body, header ,req, function (modified) {

                var neTag=etag(typeof modified == "object" ? JSON.stringify(modified).toString('utf8') : modified);
                var oeTag=req.get('If-None-Match');
                res.setHeader('ETag', neTag);
                if(neTag===oeTag){
                    res.statusCode=304;
                    arguments[1] = undefined;
                    arguments[0] = '';
                }else{
                    arguments[0] = typeof modified == "string" ? modified : JSON.stringify(modified); //JSON.stringify(body);
                    res.setHeader('Content-Length', arguments[0].length);
                    if (!chunk) {
                        res.setHeader('Content-Type', 'application/json; charset=utf-8');
                        arguments[1] = undefined;
                        res.write(arguments[0]);
                    }
                }
                oldEnd.apply(res, arguments);
            });
        }else{
            oldEnd.apply(res, arguments);
        }
    };
}


exports.interceptOnFly=function(req,res,callback){
    overrideEnd(req,res,callback);
};

exports.intercept=function(callback){

    return(function(req,res,next){
        overrideEnd(req,res,callback);
        next();
    });
};



/**
 * Middleware: interceptByStatusCode
 * ---------------------------------
 * Intercepts HTTP responses based on specific status codes before they are sent to the client.
 *
 * This middleware overrides `res.end()` to detect when the response status matches
 * one of the specified status codes. If a match occurs, it executes a user-defined callback
 * instead of sending the original response.
 *
 * The callback receives the `req` object and a `respond` function that can be used
 * to send a new response (e.g., render a custom error page or send a JSON message).
 *
 * To prevent infinite loops, the middleware automatically sets an internal flag
 * (`res.__interceptHandled`) so that subsequent calls to `res.send()` or `res.end()`
 * triggered inside the callback are not intercepted again.
 *
 * ---
 * @param {number|number[]} statusCodes - A single HTTP status code or an array of codes to intercept.
 * @param {(req: Request, respond: (newStatusCode: number, content: any) => void) => void} callback
 *        A function executed when the response matches one of the specified status codes.
 *        It receives:
 *          - `req`: The Express request object.
 *          - `respond(newStatusCode, content)`: A helper to send a new response.
 *            If `newStatusCode` is omitted, the original status code is reused.
 *
 * @returns {Function} Express middleware function.
 *
 * @example
 * // Example usage:

 *
 * app.use(interceptByStatusCode(403, (req, respond) => {
 *   respond(200, '<h1>Access Denied</h1><p>You are not authorized to view this page.</p>');
 * }));
 *
 * app.get('/private', (req, res) => {
 *   res.status(403).send('Forbidden');
 * });
 *
 * // The client will receive the HTML defined in the callback instead of "Forbidden"
 */

exports.interceptByStatusCode = function (statusCodes, callback) {
    return function (req, res, next) {
        const originalEnd = res.end;

        res.end = function (...args) {
            // Prevent recursive interception (e.g. callback triggers res.send again)
            if (res.__interceptHandled) {
                return originalEnd.apply(this, args);
            }

            // Normalize statusCodes into an array of numbers
            const statusCodeList = Array.isArray(statusCodes)
                ? statusCodes
                : typeof statusCodes === 'number'
                    ? [statusCodes]
                    : [];

            // Check if current response status matches one of the target codes
            const hasStatus = statusCodeList.some(
                (status) => typeof status === 'number' && res.statusCode === status
            );

            if (hasStatus) {
                // Mark response as handled to avoid infinite loops
                res.__interceptHandled = true;

                // Execute user callback, giving it the request and a custom responder
                callback(req, function (newStatusCode, content) {
                    // If no new status is provided, reuse the original one
                    if (typeof newStatusCode !== 'number') newStatusCode = res.statusCode;

                    // Send the custom response content
                    res.status(newStatusCode).send(content);
                });
            } else {
                // Continue normal response behavior if not intercepted
                originalEnd.apply(this, args);
            }
        };

        next();
    };
};




/**
 * interceptByStatusCodeRedirectTo(statusCodes, callback)
 * ======================================================
 *
 * Middleware for Express.js that intercepts specific HTTP response status codes
 * (e.g., 403, 404, 500) and performs a redirect to another route.
 *
 * This can be used, for example, to automatically redirect users to a custom
 * "Access Denied" or "Not Found" page when a certain response code is about to be sent.
 *
 * The middleware supports **two operation modes**:
 *
 * 1️⃣ **Callback function mode**
 *    - The `callback` parameter is a function `(req, redirect)` that allows
 *      dynamic redirect decisions based on the request.
 *    - The `redirect` argument is a helper function that should be called
 *      with the new route path.
 *
 * 2️⃣ **Static route mode**
 *    - The `callback` parameter is a string representing a fixed redirect route.
 *    - The middleware will automatically redirect to that path when the
 *      specified status code is detected.
 *
 * ---
 *
 * @param {number|number[]} statusCodes
 *   A single status code (e.g., `403`) or an array of codes (e.g., `[403, 404]`)
 *   to intercept and handle.
 *
 * @param {function|string} callback
 *   - If a **function**, it will be executed as `callback(req, redirect)`.
 *     The callback can decide dynamically where to redirect the request.
 *   - If a **string**, it is used as a fixed redirect route (e.g., `"/not-found"`).
 *
 * ---
 *
 * @example
 * // Example 1: Redirect all 403 responses dynamically
 * app.use(
 *   interceptByStatusCodeRedirectTo(403, (req, redirect) => {
 *     if (req.user) redirect('/no-access');
 *     else redirect('/login');
 *   })
 * );
 *
 * @example
 * // Example 2: Redirect all 404 responses to a static route
 * app.use(
 *   interceptByStatusCodeRedirectTo(404, '/not-found')
 * );
 *
 * ---
 *
 * @returns {Function} Express middleware function `(req, res, next)`.
 *
 * @note
 * The middleware automatically prevents infinite redirect loops by setting
 * a temporary internal flag (`res.__interceptHandled`).
 *
 * It restores the original `res.end()` behavior for all non-intercepted responses.
 */


exports.interceptByStatusCodeRedirectTo = function (statusCodes, callback) {
    return function (req, res, next) {
        const originalEnd = res.end;

        res.end = function (...args) {
            // Prevent recursive interception (avoid redirect loops)
            if (res.__interceptHandled) {
                return originalEnd.apply(this, args);
            }

            // Normalize statusCodes into an array of numbers
            const statusCodeList = Array.isArray(statusCodes)
                ? statusCodes
                : typeof statusCodes === 'number'
                    ? [statusCodes]
                    : [];

            // Check if response matches one of the intercepted status codes
            const hasStatus = statusCodeList.some(
                (status) => typeof status === 'number' && res.statusCode === status
            );

            if (hasStatus) {
                // Mark as handled to avoid recursive interception
                res.__interceptHandled = true;

                try {
                    if (typeof callback === 'function') {
                        // Execute user callback with redirect helper
                        callback(req, function (newRoute) {
                            if (typeof newRoute === 'string' && newRoute.trim()) {
                                res.redirect(newRoute);
                            } else {
                                console.warn('Invalid redirect route from callback:', newRoute);
                                originalEnd.apply(res, args);
                            }
                        });
                    } else if (typeof callback === 'string' && callback.trim()) {
                        // Direct string: use it as a route to redirect
                        res.redirect(callback);
                    } else {
                        console.warn('Invalid callback for interceptByStatusCodeRedirectTo:', callback);
                        originalEnd.apply(res, args);
                    }
                } catch (err) {
                    console.error('Error during redirect interception:', err);
                    originalEnd.apply(res, args);
                }

                // Clean up flag after response completes
                res.on('finish', () => { delete res.__interceptHandled; });
            } else {
                // Continue normal response flow
                originalEnd.apply(this, args);
            }
        };

        next();
    };
};




/*
 <table><tbody>
 <tr><th align="left">Alessandro Romanino</th><td><a href="https://github.com/aromanino">GitHub/aromanino</a></td><td><a href="mailto:a.romanino@gmail.com">mailto:a.romanino@gmail.com</a></td></tr>
 <tr><th align="left">Guido Porruvecchio</th><td><a href="https://github.com/gporruvecchio">GitHub/porruvecchio</a></td><td><a href="mailto:guido.porruvecchio@gmail.com">mailto:guido.porruvecchio@gmail.com</a></td></tr>
 </tbody></table>
 * */