package server;

public class ApplicationConfig {
    private static final String ENV_DEBUG = "DEBUG_MODE";
    private static final String ENV_DATABASE_URL = "DATABASE_URL";
    private static final String ENV_DISABLE_DATABASE_PERSISTENCE = "DISABLE_DATABASE_PERSISTENCE";

    public static boolean DEBUG = System.getenv(ENV_DEBUG) != null;
    public static String DATABASE_URI = System.getenv(ENV_DATABASE_URL);
    public static boolean DISABLE_DATABASE_PERSISTENCE = parseBoolean(
            System.getenv(ENV_DISABLE_DATABASE_PERSISTENCE), false);

    private static boolean parseBoolean(String value, boolean defaultValue) {
        if (value == null) {
            return defaultValue;
        }
        String normalized = value.trim().toLowerCase();
        return normalized.equals("1")
                || normalized.equals("true")
                || normalized.equals("yes")
                || normalized.equals("y")
                || normalized.equals("on");
    }
}
