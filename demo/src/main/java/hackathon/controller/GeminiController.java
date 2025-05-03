package hackathon.controller;

import hackathon.gemini.GeminiService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;


@RestController
@RequestMapping("/gemini")
public class GeminiController {

    private final GeminiService geminiService;

    public GeminiController(GeminiService geminiService) {
        this.geminiService = geminiService;
    }

    @GetMapping("/ask-default")
    public String askDefault() {
        String defaultPrompt = "Explain how AI works";
        return geminiService.callGeminiApi(defaultPrompt);
    }

    @GetMapping("/ask")
    public String askWithQueryParam(@RequestParam String prompt) {
        return geminiService.callGeminiApi(prompt);
    }

    @PostMapping("/ask-body")
    public String askWithBody(@RequestBody PromptRequest promptRequest) {
        return geminiService.callGeminiApi(promptRequest.getPrompt());
    }

    public static class PromptRequest {
        private String prompt;

        public String getPrompt() {
            return prompt;
        }

        public void setPrompt(String prompt) {
            this.prompt = prompt;
        }
    }
}