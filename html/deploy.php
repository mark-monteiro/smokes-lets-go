<?php
    //TODO: fix android key unlocking
    //TODO: deploy staging branch to test website
    
    //define constants
    define("TEMP_DIR", "../buildTemp");
    define("SOURCE_ZIP", "../source.zip");
    define("ADOBE_CREDS", "mark.monteiro23@gmail.com:fF709iWn");

    //if post request sent from GitHub
    //only run for pushes to the 'master' branch
    if($_SERVER['REQUEST_METHOD'] === 'POST' &&
        json_decode($_REQUEST['payload'])->ref !== "refs/heads/master") {
        exit(0);
    }
    
    ob_start();                            //start output buffer so we can email the page later
    register_shutdown_function('finish');  //register a shutdown function in case script exits unexpectedly
    set_time_limit(0);                     //remove execution time limit since this is a long script
    
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
    );

    // Run the commands for output
    $output = '';
    foreach($commands AS $command){
        // Run it
        $tmp = shell_exec($command);
        // Output
        $output .= "<span style='color: #6BE234;'>\$</span> <span style='color: #729FCF;'>{$command}\n</span>";
        $output .= htmlentities(trim($tmp)) . "\n";
    }
    
    // Make it pretty for manual user access (and why not?)
?>
<!DOCTYPE HTML>
<html lang="en-US">
<head>
    <meta charset="UTF-8">
    <title>DEPLOYMENT SCRIPT</title>
</head>
<body style="background-color: #000000; color: #FFFFFF; font-weight: bold; padding: 0 10px;">
<pre>
 .  ____  .    ____________________________
 |/      \|   |                            |
[| <span style="color: #FF0000;">&hearts;    &hearts;</span> |]  | Git Deployment Script v0.1 |
 |___==___|  /              &copy; oodavid 2012 |
              |____________________________|

<?php echo $output; ?>
</pre>

<h2>PhoneGap Build</h2>
Packaging Code...
<?php
    //package code
    $packageResult = packageCode();
    
    //check for errors
    if($packageResult['success'] === false) {
        ?><span style='color:red;'>Error</span><br/><?php
        echo($packageResult['error']);
        exit(-1);
    }
?>
<span style='color:#6BE234;'>Done</span><br/>

Authorizing with PhoneGap...
<?php
    //authorize with PhoneGap
    $authResult = pgAuth();
    
    //check for errors
    if($authResult['success'] === false) {
        ?><span style='color:red;'>Error</span><br/><?php
        echo($authResult['error']);
        exit(-1);
    }
?>
<span style='color:#6BE234;'>Done</span><br/>

Unlocking Android Signing Key...
<?php
    //send update to PhoneGap
    $unlockResult = unlockKey($authResult['result']->access_token, $packageResult['result']);
    
    //check for errors
    if($unlockResult['success'] === false) {
        ?><span style='color:red;'>Error</span><br/><?php
        echo($unlockResult['error']);
        exit(-1);
    }
?>
<span style='color:#6BE234;'>Done</span><br/>

Uploading Source Code to PhoneGap...
<?php
    //send update to PhoneGap
    $updateResult = pgUpdate($authResult['result']->access_token, $packageResult['result']);
    
    //check for errors
    if($updateResult['success'] === false) {
        ?><span style='color:red;'>Error</span><br/><?php
        echo($updateResult['error']);
        exit(-1);
    }
?>
<span style='color:#6BE234;'>Done</span><br/>

<!-- monitor build progress -->
<?php
    //TODO: periodically check build progress
?>

Removing Temporary Files...
<?php
    //remove temp files and check for errors
    if(removeTempFiles() === false) {
        ?><span style='color:red;'>Error</span><br/><?php
        exit(-1);
    }
?>
<span style='color:#6BE234;'>Done</span>

<br/>
Download new builds from: <a href="https://build.phonegap.com/apps/1050100">https://build.phonegap.com/apps/1040781</a>
</body>
</html>

<?php
    function packageCode() {
        $copyIgnore = array("buildTemp", "README.md", "source.zip", ".git", ".gitignore"); //ignore these folders/files while copying
        recurse_copy(realpath(".."), TEMP_DIR, array_merge(array("html"), $copyIgnore));  //copy root folder to temp dir
        recurse_copy(realpath("."), TEMP_DIR, $copyIgnore);                               //copy html folder to temp dir
        return zip(TEMP_DIR, SOURCE_ZIP);                                                //zip temp directory
    }
    
    function pgAuth() {
        //set parameters
        $authUrl = "https://build.phonegap.com/authorize";
        $authData = array(
            'client_id' => 'f5c03aae8bcd8ea3519d',
            'client_secret' => '0929c2d4cbdd81ea5b196ad4fdace4c946ba4da7',
            'auth_token' => 'FY-pUxfoq_RdLTNXqWSF');

        //configure request
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $authUrl);    
        curl_setopt($ch, CURLOPT_POST, 1);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $authData);
        
        //send request and return result
        return pgCurl($ch);
    }
    
    function unlockKey() {
        //TODO: this is not working correctly. Fix.
        //set parameters
        $updateUrl = "https://build.phonegap.com/api/v1/keys/android/73712";
        //TODO: no fucking special characters in these passwords
        $updateData = array(
            'data' => json_encode(array("key_pw" => 'AL&I8SIcT2h~',
                                        "keystore_pw" => '}W{]J0Vy-),E')));

        //configure request
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $updateUrl);
        curl_setopt($ch, CURLOPT_UPLOAD,1);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $updateData);
        curl_setopt($ch, CURLOPT_USERPWD, ADOBE_CREDS);
        curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_BASIC);

        //send request and return result
        return pgCurl($ch);
    }
    
    function pgUpdate($accessToken, $sourceCode) {
        //set parameters
        $updateUrl = "https://build.phonegap.com/api/v1/apps/1050100";
        $updateData = array(
            //'access_token' => $accessToken,
            'file' => '@'.realpath($sourceCode));
        
        //configure request
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $updateUrl);
        curl_setopt($ch, CURLOPT_UPLOAD,1);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $updateData);
        curl_setopt($ch, CURLOPT_USERPWD, ADOBE_CREDS);
        curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_BASIC);

        //send request and return result
        return pgCurl($ch);
    }
    
    function removeTempFiles() {
        //delete temp folder
        if(file_exists(TEMP_DIR)) {
            recurseDelete(TEMP_DIR);
        }

        //delete zip archive
        if(file_exists(SOURCE_ZIP)) {
            unlink(realpath(SOURCE_ZIP));
        }
        
        return true;
    }
    
    //called on script completion or exit()
    function finish() {
        //delete any temporary files and folders
        //TODO: implement
    
        //make sure temp files are deleted
        removeTempFiles();
    
        //flush all output and email results
        email_result(ob_get_flush());
    }
?>
    
<?php
    /*
     *  Helper Functions
     */
    
    //recursively copy folder contents
    function recurse_copy($src,$dst,$exclude = array()) { 
        $dir = opendir($src); 
        @mkdir($dst); 
        while(false !== ($file = readdir($dir))) {
            //skip '.', '..', src and dst directories (and user-specified excluded directory)
            if(($file == '.') || ( $file == '..' ) || in_array($file, $exclude)) { 
                continue;
            }
            
            if(is_dir($src.'/'.$file)) { 
                //recurse on directory
                recurse_copy($src.'/'.$file, $dst.'/'.$file); 
            } 
            else { 
                //copy file
                copy($src.'/'.$file, $dst.'/'.$file); 
            }
        }
        closedir($dir); 
    } 
    
    //zip everything from $source to an archive $destination
    function Zip($source, $destination) {
        if (!extension_loaded('zip')) {
            return array("success" => false, "error" => "Zip Error: zip extension not loaded");
        }
        
        if(!file_exists($source)) {
            return array("success" => false, "error" => "Zip Error: file/folder '{$source}' doesn't exist");
        }

        $zip = new ZipArchive();
        if (!$zip->open($destination, ZIPARCHIVE::CREATE)) {
            return array("success" => false, "error" => "Error opening zip file: ".$zip->getStatusString() );
        }

        $source = str_replace('\\', '/', realpath($source));

        if (is_dir($source) === true)
        {
            $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($source), RecursiveIteratorIterator::SELF_FIRST);

            foreach ($files as $file)
            {
                $file = str_replace('\\', '/', $file);

                // Ignore "." and ".." folders
                if( in_array(substr($file, strrpos($file, '/')+1), array('.', '..')) ) {
                    continue;
                }

                $file = realpath($file);

                if (is_dir($file) === true)
                {
                    $zip->addEmptyDir(str_replace($source . '/', '', $file . '/'));
                }
                else if (is_file($file) === true)
                {
                    $zip->addFromString(str_replace($source . '/', '', $file), file_get_contents($file));
                }
            }
        }
        else if (is_file($source) === true)
        {
            $zip->addFromString(basename($source), file_get_contents($source));
        }

        // create zip archive and check for success
        if(!$zip->close())
        {
            return array("success" => false, "error" => "Error creating zip file: ".$zip->getStatusString() );
        }
        else
        {
            return array("success" => true, "result" => $destination);
        }
    }

    //recursively delete all files and directories
    function recurseDelete($path) {
        $dir = realpath($path);
        $it = new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS);
        $files = new RecursiveIteratorIterator($it,
                     RecursiveIteratorIterator::CHILD_FIRST);
        
        foreach($files as $file) {
            if ($file->isDir()){
                rmdir($file->getRealPath());
            } else {
                unlink($file->getRealPath());
            }
        }
        rmdir($dir);
    }
    
    //send a request to the PhoneGap API
    function pgCurl($ch) {
        $return = array("success" => false,
                        "error" => null,
                        "result" => null);
        
        //finish configuring and send request
        curl_setopt($ch, CURLOPT_HTTPHEADER, array("Expect:"));
        //curl_setopt($ch, CURLOPT_HTTP_VERSION, CURL_HTTP_VERSION_1_0);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        $result = curl_exec($ch);
        
        //check for cURL failure
        if($result === false) {
            $return['error'] = "cURL error: ".curl_error($ch);
        }
        else {
            //extract response body and decode JSON response
            //TODO: this method doesn't return the correct header size for some reason. fix it
            //$header_size = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
            //$result = substr($result, $header_size);
            
            $bodyStart = strpos($result, "{");
            $bodyEnd = strrpos($result, "}", $bodyStart);
            $result = substr($result, $bodyStart, $bodyEnd - $bodyStart + 1);
            $resultObject = json_decode($result);
            
            //check for JSON errors
            if($resultObject === null) {
                $return['error'] = "JSON error: ".json_last_error()."\n$result";
            }
            else {
                //get the response code
                $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                $statusCodeClass = (int)floor($statusCode / 100);
                
                //check for errors before returning result
                if($statusCodeClass !== 2 && isset($resultObject->error)) {
                    $return['error'] = "PhoneGap request error ($statusCode) : {$resultObject->error}";
                }
                elseif($statusCodeClass !== 2) {
                    $return['error'] = "Error: PhoneGap request returned $statusCode";
                }
                else{
                    $return['success'] = true;
                    $return['result'] = $resultObject;
                }
            }
        }
        
        //close curl object and return result
        curl_close($ch);
        return $return;
    }
    
    //sends an email containing the output in buffer
    function email_result($buffer) {
        // To send HTML mail, the Content-type header must be set
        $headers  = 'MIME-Version: 1.0' . "\r\n";
        $headers .= 'Content-type: text/html; charset=iso-8859-1' . "\r\n";
    
        //set email content
        $to = "mark.monteiro23@gmail.com";//, travis.vanos@gmail.com";
        $subject = "Website Code Updated on Smokes Lets Go (".$_SERVER['REMOTE_ADDR'].")";
        $message = $buffer;
        
        //send the email
        mail($to, $subject, $message, $headers);
    }
?>
