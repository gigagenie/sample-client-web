/**
 * allert.js
 * A simple JavaScript notification library
 *
 * author: Philippe Silva
 * date: december 09, 2018
 * version: 1.0.0
 *
 */

/*
 * Show a allert on the page
 * Params:
 *  text: text to show
 *  options: object that can override the following options
 *    type: alert will have class 'alert-color'. Default null
 *    icon: class of the icon to show before the alert. Default null,
 *    duration: duration of the notification in ms. Default 2000ms
 *    container-id: id of the alert container. Default 'body'
*/
function allert(text, options) {
    "use strict";

    const defaultOptions = {
        'type': null, // type is  CSS class `alert-type`
        'align': "top-right",
        'icon': null, // class of the icon to show before the alert text
        'duration': 3000, // duration of the notification in ms
        'container-id': "body" // id of the alert container
    };

    options = typeof options === "object" ? options : defaultOptions;

    // set options
    for (var propertyName in defaultOptions) {

        if (defaultOptions.hasOwnProperty(propertyName)) {

            if (options[propertyName] === undefined ||
                options[propertyName] === null ||
                options[propertyName] === "") {

                options[propertyName] = defaultOptions[propertyName];
            }
        }

    }

    const container = options["container-id"] === "body" ? document.getElementsByTagName("body")[0] : document.getElementById(options["container-id"]);

    var typeMarkup = "";

    if (options.type) {
        typeMarkup = `allert-${options.type}`;
    }

    var iconMarkup = "";

    if (options.icon) {
        iconMarkup = `<span class='${options.icon}'></span> `;
    }

    // Generate the HTML
    var element = document.createElement("div");

    element.setAttribute("class", `allert allert-${options.align} ${typeMarkup}`);
    element.setAttribute("title", text);

    element.innerHTML = iconMarkup + text;

    container.appendChild(element);

    var close = function (element) {

        element.classList.add("allert-fadeout");

        // after the fadeout remove the element from DOM
        setTimeout(function () {
            element.remove();
        }, 1000);
    };

    // Remove allert on click
    element.addEventListener("click", function () {
        close(this);
    });

    // After 'duration' seconds, remove allert
    setTimeout(function () {
        close(element);
    }, options.duration);
}
