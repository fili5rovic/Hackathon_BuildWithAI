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
        String defaultPrompt = "Can you find hate speech keywords and only show them in a json format from this sentence:\n" +
"Jebote, kad vidiš kako pojedini ljudi glume da su neka elita, da pripadaju nekoj kurčevoj visokoj klasi. Ono, odu iz sela u grad, završe neki fakultet i automatski više nikog ne poznaju. Kad dođu u selo preko vikenda ili na leto, sve gledaju sa visine, svi su glupi neobrazovani seljaci i slicne priče. Mislim realno, svako zna bar jednu takvu osobu.";
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