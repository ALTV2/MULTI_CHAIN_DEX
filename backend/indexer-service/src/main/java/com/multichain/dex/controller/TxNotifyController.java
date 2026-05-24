package com.multichain.dex.controller;

import com.multichain.dex.dto.TxNotifyRequest;
import com.multichain.dex.service.TxNotifyService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v2/tx")
@RequiredArgsConstructor
public class TxNotifyController {

    private final TxNotifyService txNotifyService;

    /**
     * Frontend notifies backend about a newly submitted transaction.
     * Backend processes it asynchronously and returns 202 Accepted immediately.
     */
    @PostMapping("/notify")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void notify(@Valid @RequestBody TxNotifyRequest request) {
        txNotifyService.processAsync(request);
    }
}
