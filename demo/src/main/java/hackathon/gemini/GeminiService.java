package hackathon.gemini;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;
import util.Gson;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

@Service
public class GeminiService {

    private static final Logger log = LoggerFactory.getLogger(GeminiService.class);

    private final RestTemplate restTemplate;
    private final String apiUrl;
    private final String apiKey;

    public GeminiService(
            RestTemplateBuilder restTemplateBuilder,
            @Value("${gemini.api.url}") String apiUrl
            ) {
        ClassPathResource resource = new ClassPathResource("apiKey");
        String apiKey = null;
        try {
            apiKey = Files.readString(resource.getFile().toPath(), StandardCharsets.UTF_8).trim();
        } catch (IOException e) {
            throw new RuntimeException(e);
        }

        this.restTemplate = restTemplateBuilder.build();
        this.apiUrl = apiUrl;
        this.apiKey = apiKey;

        if (apiKey == null || apiKey.isEmpty() || apiKey.equals("YOUR_GEMINI_API_KEY")) {
            log.warn("------------------------------------------------------");
            log.warn("Gemini API Key is not configured in application.properties!");
            log.warn("Please set 'gemini.api.key'. Calls will likely fail.");
            log.warn("------------------------------------------------------");
        }
    }

    public String callGeminiApi(String promptText) {
        String urlWithKey = UriComponentsBuilder.fromHttpUrl(apiUrl)
                .queryParam("key", apiKey)
                .toUriString();

        // Prepare Headers
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        // Prepare Request Body
        GeminiRequest requestBody = GeminiRequest.fromText(promptText);

        // Create Request Entity
        HttpEntity<GeminiRequest> requestEntity = new HttpEntity<>(requestBody, headers);

        log.info("Calling Gemini API at: {}", apiUrl); // Don't log the key
        log.debug("Request Body: {}", requestBody); // Be careful logging request bodies if they contain sensitive data

        try {
            ResponseEntity<String> responseEntity = restTemplate.exchange(
                    urlWithKey,
                    HttpMethod.POST,
                    requestEntity,
                    String.class // Expecting the response body as a String
            );

            log.info("Gemini API call successful with status code: {}", responseEntity.getStatusCode());
            log.debug("Response Body: {}", responseEntity.getBody());
            String response = Gson.getText(responseEntity.getBody());
            return response;

        } catch (RestClientException e) {
            log.error("Error calling Gemini API: {}", e.getMessage(), e);
            return "Error: Could not get response from Gemini API. " + e.getMessage();
        }
    }
}