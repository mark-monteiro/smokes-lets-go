<?php
    require_once 'HTTP/Request2.php';

    //NOTE: the following environment variables must be set for this script to work
    //  GITHUB_DEPLOY_HOOK_SECRET
    //  PHONEGAP_APP_ID
    //  ANDROID_KEY_ID
    //  ANDROID_KEY_PW
    //  ANDROID_KEYSTORE_PW
    //  ADOBE_USERNAME
    //  ADOBE_PASSWORD
    //  SERVER_ADMIN

    $TEMP_DIR = "buildTemp";
    $SOURCE_ZIP = "source.zip";
    $error = false;

    //run the script from the context of the source root folder
    chdir('..');

    //throw exceptions on notices and warnings
    set_error_handler(function($errNo, $errStr, $errFile, $errLine) {
        if (error_reporting() !== 0) {
            throw new ErrorException("$errStr in $errFile on line $errLine", $errNo);
        }
    }, E_NOTICE | E_WARNING);

    //exit immediately if this is not a valid request to this page
    if(!verifyRequest()) {
        //TODO: if we get here, show a user authentication form
        //TODO: if request is not valid, send a different email
        header('X-PHP-Response-Code: 404', true, 404);
        echo "<h1>404 Not Found</h1>";
        echo "The page that you have requested could not be found.";
        exit();
    }
    
    function verifyRequest() {
        if(getenv('DEBUG')) {
            return true;
        }

        //check for post
        if($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return false;
        }

        //verify GitHub secret
        if(githubscret != getenv('GITHUB_DEPLOY_HOOK_SECRET')) {
           return false;
        }

        //make sure payload exists
        if(!isset($_REQUEST['payload'])) {
            return false;
        }

        //make sure this is the master branch
        $branch = json_decode($_REQUEST['payload']);
        if($branch !== 'refs/heads/master') {
            return false;
        }

        return true;
    }

    ob_start();                                 //start output buffer so we can email the page later
    register_shutdown_function('email_result'); //email the results on script completion (even on errors)
    set_time_limit(0);                          //remove execution time limit since this is a long script
?>

<!DOCTYPE HTML>
<html lang="en-US">
<head>
    <meta charset="UTF-8">
    <title>DEPLOYMENT SCRIPT</title>
</head>
<body style="background-color: #000000; color: #FFFFFF; font-weight: bold; padding: 0 10px;">
<h2>Create Build Package</h2>
<pre>
 .  ____  .    ____________________________
 |/      \|   |                            |
[| <span style="color: #FF0000;">&hearts;    &hearts;</span> |]  | Git Deployment Script v0.1 |
 |___==___|  /              &copy; oodavid 2012 |
              |____________________________|
<?php
    /**
     * GIT DEPLOYMENT SCRIPT
     *
     * Used for automatically deploying websites via github or bitbucket, more deets here:
     *
     *        https://gist.github.com/1809044
     */

    // The commands
    $commands = array(
        'echo $PWD',
        'whoami',
        'git pull',
        'git status',
        'git submodule sync',
        'git submodule update',
        'git submodule status',
        "./package-app.sh $TEMP_DIR $SOURCE_ZIP",
    );

    // Run the commands for output
    foreach($commands AS $command){
        // Run it
        $cmdResult = -1;
        $cmdOutput = array();
        exec("$command 2>&1", $cmdOutput, $cmdResult);

        //sanitize output
        $cmdOutput = array_map('htmlentities', $cmdOutput);
        $cmdOutput = array_map('trim', $cmdOutput);

        // Output
        ?><span style='color: #6BE234;'>$</span><?php
        echo("<span style='color: #729FCF;'>{$command}\n</span>");
        echo(join("\n", $cmdOutput) . "\n");

        // Break on errors
        if ($cmdResult != 0) {
            ?><span style='color: red;'>ERROR\n</span><?php
            exit();
        }
    }
?>
</pre>

<h2>PhoneGap Build</h2>
<pre>
<?php
    $authResult = buildStep('Authorize with PhoneGap', 'pgAuth');
    $token = $authResult->result->token;
    buildStep('Unlock Android signing key', 'pgUnlockKey', $token);
    buildStep('Upload source code to PhoneGap', 'pgUpdate', $token, $SOURCE_ZIP);

    //TODO:
    // start the build
    // periodically check build progress
    // wait for build completion
    // download completed app install files
    $downloadUrl = "https://build.phonegap.com/apps/".getenv('PHONEGAP_APP_ID');
?>
</pre>

<br/>
Download new builds from: <a target='_blank' href='<?php echo($downloadUrl) ?>'><?php echo($downloadUrl) ?></a>
</body>
</html>

<?php
    /** PhoneGap Build Methods **/
    //TODO: make a bash script to also handle this stuff

    class BuildStepResult
    {
        public $sucess = false;
        public $error = null;
        public $result = null;

        public function __construct($result, $success = false) {
            $this->success = $success;
            if($success === true) {
                $this->result = $result;
            }
            else {
                $this->error = $result;
            }
        }
    }

    function buildStep($message, $function) {
        echo($message."...\n");
        $args = array_slice(func_get_args(), 2);
        $stepResult = call_user_func_array($function, $args);
        echo($message.'...');

        //check for errors
        if($stepResult->success === false) {
            ?><span style='color:red;'>Error</span><br/><?php
            echo(htmlentities($stepResult->error));
            exit(-1);
        }
        else {
            ?><span style='color:#6BE234;'>Done</span><br/><?php
        }

        echo("==============================\n");
        return $stepResult;
    }

    function pgAuth() {
        $authUrl = "https://build.phonegap.com/token";
        $request = new HTTP_Request2($authUrl, HTTP_Request2::METHOD_POST);
        $request->setAuth(getenv('ADOBE_USERNAME'), getenv('ADOBE_PASSWORD'));
        return phonegapApiRequest($request);
    }
    
    function pgUnlockKey($accessToken) {
        //TODO: this is not working correctly. Make it work.
        //set parameters
        $updateUrl = "https://build.phonegap.com/api/v1/keys/android/".getenv('ANDROID_KEY_ID');
        $updateData = json_encode(array(
            'auth_token' => $accessToken,
            'data' => array(
                "key_pw" => getenv('ANDROID_KEY_PW'),
                "keystore_pw" => getenv('ANDROID_KEYSTORE_PW'))));

        //send request and return result
        $request = new HTTP_Request2($updateUrl, HTTP_Request2::METHOD_PUT);
        $request->setHeader('Content-type: multipart/form-data');
        $request->setBody($updateData);
        //TODO: check status of 'locked' field before returning
        return phonegapApiRequest($request);
    }
    
    function pgUpdate($accessToken, $sourceCode) {
        //set parameters
        $updateUrl = "https://build.phonegap.com/api/v1/apps/1050100";
        $updateFile = fopen(realpath($sourceCode), 'r');

        //send request and return result
        $request = new HTTP_Request2($updateUrl, HTTP_Request2::METHOD_PUT);
        $request->setHeader('Content-type: multipart/form-data');
        $request->addUpload('file', $updateFile);
        return phonegapApiRequest($request);
    }

    //send a request to the PhoneGap API
    function phonegapApiRequest($request) {
        $request->setConfig('follow_redirects', true);
        
        //token authentication isn't working so we'll send credentials on every request for now
        //TODO: get token authentication to work
        $request->setAuth(getenv('ADOBE_USERNAME'), getenv('ADOBE_PASSWORD'));
        
        //TODO: use PhoneGap's CA to secure the request. this is a security hole for now
        //$request->setConfig('ssl_cafile', 'phonegap_ca.crt');
        $request->setConfig('ssl_verify_peer', false);

        //send request
        try {
            echo("Sending request to <a href='{$request->getUrl()}'>{$request->getUrl()}</a>\n");
            $response = $request->send();
            echo("Got response ({$response->getStatus()}):\n{$response->getBody()}\n");
        } catch (HTTP_Request2_Exception $e) {
            return new BuildStepResult('Http Request Error: ' . $e->getMessage());
        }

        //deserialize response and get status code
        $responseBody = $response->getBody();
        $resultObject = json_decode($responseBody);
        $statusCode = $response->getStatus();
        $statusCodeClass = (int)floor($statusCode / 100);

        //check for errors in status code or deserialization
        if($statusCodeClass !== 2 && isset($resultObject->error)) {
            return new BuildStepResult("PhoneGap request error ($statusCode) : {$resultObject->error}");
        }
        elseif($statusCodeClass !== 2) {
            return new BuildStepResult('Unexpected HTTP status: '.$response->getStatus().' '.$response->getReasonPhrase());
        }
        elseif($resultObject === null) {
            return new BuildStepResult("JSON error: ".json_last_error()."\n$responseBody");
        }

        //everything ok; return result
        return new BuildStepResult($resultObject, true);
    }

    //sends an email containing the output in buffer
    function email_result() {
        //TODO: send source code archive as attachment
        //TODO: send completed builds as attachments

        // To send HTML mail, the Content-type header must be set
        $headers  = 'MIME-Version: 1.0' . "\r\n";
        $headers .= 'Content-type: text/html; charset=iso-8859-1' . "\r\n";
    
        //set email content
        $to = getenv('SERVER_ADMIN');
        $branchName = 'master';
        $subject = "Smokes Lets Go ({$branchName}) Updated by {$_SERVER['REMOTE_ADDR']}";
        $message = ob_get_flush();

        //send the email
        mail($to, $subject, $message, $headers);
    }
?>