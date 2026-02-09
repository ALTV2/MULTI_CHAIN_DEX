package com.multichain.dex.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class NonceResponse {
    private String message;
    private String nonce;
}
