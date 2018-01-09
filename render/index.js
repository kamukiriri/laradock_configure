const electron = require('electron');
const ipcRenderer = electron.ipcRenderer;
const dialog = electron.remote.dialog;
const browser = electron.remote.BrowserWindow;
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const child_process = require('child_process');

const config = electron.remote.getGlobal('config');

const state = {
    laradockPath: null,
    envPath: "",
    envData: null,
};

$(function(){
    // init ui
    $('title, .navbar-brand').text(config.title);

    //init vue component
    state.envData = new EnvData("");
    const vmContent = new Vue({
        el: '#content',
        data: state
    });
    const vmModalRun = new Vue({
        el: '#modelRun',
        data: {
            containers: [],
        }
    });

    // init ui event
    $('[name=browse]').click(()=>{
        dialog.showOpenDialog(browser.getFocusedWindow(), {
            //defaultPath: ".",
            properties: [
                'openFile',
                'showHiddenFiles'
            ],
            filters: [
                {name: 'env', extensions: ['env']},
                {name: 'All Files', extensions: ['*']}
            ]
        }, (files)=>{
            if(!files) return;
            if(!fs.existsSync(files[0])) return;

            state.envPath = files[0];
            $('[name=envPath]').val(state.envPath);
        })
    });

    $('[name=load]').click(()=>{
        try {
            const file = fs.readFileSync(state.envPath);
            const envText = file.toString();
            state.envData = new EnvData(envText);
        } catch(err){
            onError("file open error", err);
        }
    });

    $('[name=save]').click(()=>{
        if(state.envData.text == "") {
            showAlert('file save error', '.env is not loaded');
            return;
        }

        dialog.showSaveDialog(browser.getFocusedWindow(), {
            defaultPath: state.envPath,
            filters: [
                {name: 'env', extensions: ['env']},
                {name: 'All Files', extensions: ['*']}
            ]
        }, (file)=>{
            if(!file) return;

            state.envPath = file;
            $('[name=envPath]').val(state.envPath);
    
            state.envData.groups.forEach((group)=>{
                group.fields.forEach((field)=>{
                    const name = field.name+"=";
                    const value = field.value;
                    state.envData.text = state.envData.text.replace(new RegExp("^"+name+".*$", "m"), name + value);
                });
            });
    
            fs.writeFileSync(state.envPath, state.envData.text);
        })
    });

    $('[name=runConfig]').click(()=>{
        const dirPath = path.dirname(state.envPath);
        state.laradockPath = dirPath;

        const envPath = path.join(dirPath, '.env');
        if(!fs.existsSync(envPath)){
            showAlert("docker-compose error", ".env not found in " + dirPath);
            return;
        }

        const dcYml = yaml.safeLoad(fs.readFileSync(path.join(dirPath, 'docker-compose.yml'), 'utf8'));
        vmModalRun.containers = Object.keys(dcYml.services);
        
        $('#modelRun').modal('show');
    });

    $('[name=runDone]').click(()=>{
        let containers = "";
        $('[name=containers]:checked').each(function(){
            containers += " " + $(this).val();
        });

        if(containers == ""){
            showAlert("docker-compose error", "Please select any container");
            return;
        }

        try {
            child_process.execSync(
                `docker-compose up -d` + containers,
                {cwd: state.laradockPath}
            );                
        } catch (error) {
            onError('docker-compose error', error);
        }

        $('#modelRun').modal('hide');
    });

    // ipc message handler
    ipcRenderer.on("log", (event, arg)=>{
        console.log(arg);
    });
});

function onError(message, err){
    showAlert(message, err.message);        
}

function showAlert(title, message){
    dialog.showMessageBox(browser.getFocusedWindow(), {
        message: title,
        detail: message
    });        
}

function showConfirm(title, message){
    const buttonIndex = dialog.showMessageBox(browser.getFocusedWindow(), {
        message: title,
        detail: message,
        buttons: ['OK', 'Cancel']
    });

    return buttonIndex == 0;
}

// env data object
let EnvData = function(envText){
    let self = this;
    
    self.text = envText;
    self.groups = [];
    self.filterText = "";

    let group;
    self.text.split(/\r\n|\r|\n/).forEach((line) => {
        if(line.length == 0){
            return true;
        }else if(line.startsWith("### ")){
            group = new EnvGroup(line.substring(4, line.indexOf(" #")));
            self.groups.push(group);
        }else if(line.startsWith("# ")){
            if(group) group.desc += line.substr(2) + "\n";
        }else if(line.startsWith("#")){
            return true;            
        }else{
            let name = line.substring(0, line.indexOf("=", -1));
            let value = line.substring(name.length+1);
            if(name && value){
                if(group) group.addField(name, value);
            }else{
                console.log("parse error: " + line);
            }
        }
    }, this);

    self.getField = function (groupName, fieldName){
        let ret = null;        
        self.groups.forEach((group)=>{
            if(group.name == groupName){
                ret = group.getField(fieldName);
                return;
            }
        });
        return ret;
    }

    self.getFilteredGroups = function(){
        if(!self.filterText){
            return self.groups;
        }

        let filterdGroups = [];
        self.groups.forEach((group)=>{
            let filterdFields = [];
            group.fields.forEach((field)=>{
                if(field.name.search(new RegExp(self.filterText, "i")) > -1){
                    filterdFields.push(field);
                }
            });
            if(filterdFields.length > 0){
                let newGroup = new EnvGroup(group.name);
                newGroup.fields = filterdFields;
                filterdGroups.push(newGroup);
            }
        });

        return filterdGroups;
    }
};
let EnvGroup = function(name){
    let self = this;

    self.name = name;
    self.desc = "";
    self.fields = [];

    self.getIdString = function(){
        return "group" + self.name.replace(/\s/g, "-");
    }

    self.addField = function (name, value){
        let field = new EnvField(name, value);
        self.fields.push(field);
    }

    self.getField = function (fieldName){
        let ret = null;
        self.fields.forEach((field)=>{
            if(field.name == fieldName){
                ret = field;
                return;
            }
        });
        return ret;        
    }
};
let EnvField = function(name, value){
    let self = this;

    self.name = name;
    self.value = value;
};