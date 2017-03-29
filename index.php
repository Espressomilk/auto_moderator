<?php
	if($_POST['start']) {
		echo "Starting auto moderator...<br>";
		exec("/usr/bin/node /home/pi/auto_moderator/server.js > /tmp/auto_moderator.log 2>&1 &", $output);
		exec("ps -A | grep node", $output);
		$pid = explode(" ", $output[0])[0];
		if($pid == '') {
			echo "Startup failed.Please retry...<br>";
		} else {
			echo "Startup successfully...<br>";
		}
	}
	if($_POST['stop']) {
		echo "Stopping auto moderator...<br>";
		exec("ps -A | grep node", $output);
		$pid = explode(" ", $output[0])[0];
		exec("kill " . $pid, $output, $state);
		if($state == 0) {
			echo "Terminated successfully.<br>";
		} else {
			echo "Terminated failed.Please retry...<br>";
		}
	}
?>

<html>
	<body>
		<form action="" method="post">
			<input type="submit" name="start" value="Start">
			<input type="submit" name="stop" value="Stop">
		</form>
	</body>
</html>