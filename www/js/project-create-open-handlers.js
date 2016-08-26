function createProject(e) {
    var projectPath = $("#projectPath").text().trim();
    var projectName = $("#projectName").val().trim();
    var projectId = $("#project-id").val().trim() || $("#project-id").attr("placeholder").trim();

    var isProjectPathEmpty = isProjectPathFieldEmpty(projectPath);
    var isProjectNameEmpty = isEmptyField(projectName);

    var projDir = "";

    hideProjectPathError();
    hideProjectNameError();
    resetProjectCreationFormHeight();

    console.log("name: " + isProjectNameEmpty + " path: " + isProjectPathEmpty);

    if(!isProjectNameEmpty && !isProjectPathEmpty) {
        projDir = projectPath + buildPathBasedOnOS("/") + projectName;
        localStorage.projDir = projDir;
        if(!projectExistsInLocalStorage(projDir)) {

            var oldPathToConfigFile = projectPath + buildPathBasedOnOS("/www/config.xml");
            var newPathToConfigFile = projectPath + buildPathBasedOnOS("/config.xml");

            fs.readFile(newPathToConfigFile, {encoding:'utf8'}, function(err, newPathData) {
                if (err) {
                    fs.readFile(oldPathToConfigFile, {encoding:'utf8'}, function(err, oldPathData) {
                        if (err) {
                            trackProjectCreated();
                            // if no www/config.xml found then create a new project
                            create(projectName, projectId, projDir);
                        } else {
                            displayPhoneGapProjectInFolderError();
                        }
                    });
                } else {
                    displayPhoneGapProjectInFolderError();
                }
            });
        } else {
            displayPhoneGapProjectInFolderError();
        }
    } else {

        if (isProjectPathEmpty) {
            // error with project path
            displayProjectPathError();
        }

        if (isProjectNameEmpty) {
            // error with project name
            displayProjectNameError();
        }

        adjustProjectCreationFormHeight(isProjectPathEmpty, isProjectNameEmpty);
    }
}

function selectProjectPath(e) {
    global.createClicked = true;
    selectDirectory(e);
}

function openProject(e) {
    selectDirectory(e);
}

function selectDirectory(e) {
    var projectDir = $("#projectDirectory").val().trim();
    var projectName = $("#projectName").val().trim();

    var isProjectPathEmpty = isProjectPathFieldEmpty(projectDir);
    var isProjectNameEmpty = isEmptyField(projectName);

    if(global.createClicked) {
        // new project creation workflow
        global.createClicked = false;
        $("#projectPath").removeClass("overlay-form-item-description");
        $("#projectPath").removeClass("italics");
        hideProjectPathError();
        $("#projectPath").text(projectDir);
        $("#projectName").focus();

        if(!projectExistsInLocalStorage(projectDir)) {

            var oldPathToConfigFile = projectDir + buildPathBasedOnOS("/www/config.xml");
            var newPathToConfigFile = projectDir + buildPathBasedOnOS("/config.xml");

            fs.readFile(newPathToConfigFile, {encoding:'utf8'}, function(err, newPathData) {
                if (err) {
                    console.log("config.xml not found in new path: " + newPathToConfigFile);
                    fs.readFile(oldPathToConfigFile, {encoding:'utf8'}, function(err, oldPathData) {
                        if (err) {
                            // assume that no www/config.xml means a project doesn't exist in selected local path
                            hideProjectPathError();
                            resetProjectCreationFormHeight();

                            $("#projectDetailsOverlay").removeClass("project-details-overlay-project-path-error");
                            $("#projectDetailsOverlay").removeClass("project-details-overlay-project-name-or-project-id-error");
                        } else {
                            // www/config.xml exists in selected local path, assume that there is an existing project in the local path
                            displayPhoneGapProjectInFolderError();
                        }
                    });
                } else {
                    console.log("config.xml found in new path");
                    // config.xml exists in selected local path, assume that there is an existing project in the local path
                    displayPhoneGapProjectInFolderError();
                }
            });
        } else {
            // selected local path already exists in local storage, assume that there is an existing project in the local path
            displayPhoneGapProjectInFolderError();
        }
    } else {
        if (projectDir.length > 0) {
            $("#overlay-bg").hide();
            hideAddCreateProjectOverlay();
            $("#plus-icon").attr("src", "img/icons/normal/plus.svg");

            // open existing project workflow
            checkIfProjectConfigExists(projectDir);
        }
    }

    $("#projectDirectory").val("");
}

function create(projectName, projectId, projDir) {
    var options = {};
    options.path = projDir;
    options.name = projectName;
    options.id = projectId;
    options.template = global.selectedTemplate;
    options.verbose = true;

    var spawn = require('child_process').spawn;
    var path = require('path');

    // Use the node executable path for the command to invoke
    var node;
    if (process.platform == 'win32') {
        node = path.join(__dirname, 'bin', 'node.exe');
    }
    else {
        node = path.join(__dirname, 'bin', 'node');
    }

    // Define command arguments
    var args = [];
    args.push(path.join(__dirname, 'node_modules', 'phonegap', 'bin', 'phonegap.js'));
    args.push('create');
    args.push(options.path);
    args.push('--template');
    args.push(options.template);
    args.push('--id');
    args.push(options.id);
    args.push('--name');
    args.push(options.name);

    // Define options
    var opts = [];
    opts.env = process.env;

    // spawn child process and include success/error callbacks
    var child = spawn(node, args, opts);
    showLoader(true);

    child.on('close', function(code) {
        if (code === 0) {
            d = new Date();
            hideLoader();
            console.log("Created project at: "+ options.path + " end time " + d.toUTCString());
            createHandler(projectName, projectId, options.path);
            setLastSelectedProjectPath(options.path);
        }
        else {
            hideLoader();
            displayErrorMessage("Project create failed with code " + code);
        }
    });
    child.on('error', function(e) {
       console.log(e);
       displayErrorMessage(e);
    });

}

function createHandler(projectName, projectId, projDir) {
    // update the config.xml of the newly created project with the project name & project id entered by the user
    updateConfig(projectName, projectId, projDir);
    global.projDir = projDir;
    hideProjectDetailsOverlay();
}

function updateConfig(projectName, projectId, projDir) {
    console.log("updateConfig");
    var newPathToConfigFile = projDir + buildPathBasedOnOS("/config.xml");

    fs.readFile(newPathToConfigFile, {encoding: 'utf8'}, function(err, newPathData) {
        if(err) {
            console.log("Error reading config file at " + newPathToConfigFile);
            displayMissingConfigFileNotification();
        } else {
            $.xmlDoc = $.parseXML(newPathData);
            console.log("updateConfigOnProjectCreation - newPathData");
            updateConfigOnProjectCreation($.xmlDoc, projectName, projectId, newPathToConfigFile, projDir);
        }
    });
}

function updateConfigOnProjectCreation(configXML, projectName, projectId, pathToConfigFile, projDir) {
    var iconPath = projDir + buildPathBasedOnOS("/www/");
    var serializer = new XMLSerializer();
    var contents = serializer.serializeToString(configXML);
    var xml = new XML(contents);
    $.xml = $(configXML);

    // update project name
    xml.child("name").setValue(projectName);

    // update project id
    xml.attribute("id").setValue(projectId);

    // get the project version
    var projVersion = xml.attribute("version").getValue();

    // get the app icon
    var projectIcon = $.xml.find("icon").attr("src");
    iconPath += projectIcon;

    // write the user entered project name & project id to the config.xml file
    fs.writeFile(pathToConfigFile, xml, function (err) {
        if (err) {
            // throw err
        } else {
            // check if the project exists in PG-GUI's localstorage before adding
            //console.log("projDir: " + projDir);
            //console.log(projectExistsInLocalStorage(projDir));
            if(!projectExistsInLocalStorage(projDir)) {
                addProject(projectName, projVersion, iconPath, projDir);
            } else {
                 displayProjectExistsNotification();
            }
        }
    });
}

function checkIfProjectConfigExists(projDir) {
    var oldPathToConfigFile = projDir + buildPathBasedOnOS("/www/config.xml");
    var newPathToConfigFile = projDir + buildPathBasedOnOS("/config.xml");

    fs.readFile(newPathToConfigFile, 'utf8', function(err, data) {
        if (err) {
            fs.readFile(oldPathToConfigFile, 'utf8', function(err, data) {
                if(err) {
                    displayMissingConfigFileNotification();

                } else {
                    console.log("oldPathToConfigFile found");
                    parseProjectConfig(data, projDir);
                }
            });
        } else {
            console.log("newPathToConfigFile found");
            parseProjectConfig(data, projDir);
        }
    });
}

function parseProjectConfig(data, projDir) {
    var iconPath = projDir + buildPathBasedOnOS("/www/");

    $.xmlDoc = $.parseXML(data);
    $.xml = $($.xmlDoc);

    // get the project name
    var projectName = $.xml.find("name").text();

    // get the project version
    var projectVersion = $.xml.find("widget").attr("version");

    // get the app icon
    var projectIcon = $.xml.find("icon").attr("src");
    iconPath += projectIcon;

    // check if the project exists in PG-GUI's localstorage before adding
    if(!projectExistsInLocalStorage(projDir)) {
        // We're going to add it, take care of UI stuff
        addProject(projectName, projectVersion, iconPath, projDir);
        //toggleServerStatus(projDir);
        trackProjectOpened();
    } else {
        displayProjectExistsNotification();
    }
}

function displayMissingConfigFileNotification() {
    setNotificationText("Selected folder doesn't contain a config.xml file.");
    displayNotification();
}

function displayProjectExistsNotification() {
    setNotificationText("You tried to add a project that already exists. A duplicate has not been added.");
    displayNotification();
}

function projectExistsInLocalStorage(projDir) {

    var projectFound = false;

    if (localStorage.projects) {
        var projects = JSON.parse(localStorage.projects);
        var index = projects.length;

        for (var i=0;i<index;i++) {
            if(projDir == projects[i].projDir) {
                projectFound = true;
                break;
            }
        }
    }

    return projectFound;
}

function folderExistsInFileSystem(projDir) {
    var folder = buildPathBasedOnOS(projDir);
    fs.exists(folder, function(exists) {
        if (exists) {
            displayDuplicateProjectNameError();
            $("#projectDetailsOverlay").addClass("project-details-overlay-duplicate-project-name-error");
        } else {
            hideDuplicateProjectNameError();
            $("#projectDetailsOverlay").removeClass("project-details-overlay-duplicate-project-name-error");
        }
    });
}
