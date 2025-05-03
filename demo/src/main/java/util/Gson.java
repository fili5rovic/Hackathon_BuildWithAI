package util;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

public class Gson {


    public static String getText(String jsonResponse) {
        JsonObject root = JsonParser.parseString(jsonResponse).getAsJsonObject();
        String text = root
                .getAsJsonArray("candidates").get(0).getAsJsonObject()
                .getAsJsonObject("content")
                .getAsJsonArray("parts").get(0).getAsJsonObject()
                .get("text").getAsString();

        return text;
    }
}
