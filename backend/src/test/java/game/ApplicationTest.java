package game;

import org.junit.Test;
import server.ApplicationConfig;
import server.SecretHitlerServer;

public class ApplicationTest {
    @Test
    public void testApplicationLauncherClassExists() {
        // Intentionally empty.
    }

    public static void main(String[] args) {
        ApplicationConfig.DEBUG = true;
        SecretHitlerServer.main(args);
    }
}
