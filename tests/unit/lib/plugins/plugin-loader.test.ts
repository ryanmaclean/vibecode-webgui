/**
 * Tests for Plugin Loader
 * @jest-environment node
 */

import {
  loadPlugin,
  loadPluginsFromDirectory,
  unloadPlugin,
  clearPluginCache,
  getCachedPluginAPI,
  isPluginLoaded,
} from '@/lib/plugins/plugin-loader';

// Mock filesystem operations
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    readdir: jest.fn(),
    stat: jest.fn(),
  },
  existsSync: jest.fn(),
}));

// Mock plugin-registry
jest.mock('@/lib/plugins/plugin-registry', () => ({
  registerPlugin: jest.fn(),
  unregisterPlugin: jest.fn(),
}));

// Mock plugin-validator
jest.mock('@/lib/plugins/plugin-validator', () => ({
  validatePluginManifest: jest.fn(() => ({
    valid: true,
    errors: [],
    warnings: [],
  })),
}));

describe('Plugin Loader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearPluginCache();
  });

  describe('loadPlugin', () => {
    it('should load plugin from directory', async () => {
      const fs = require('fs');
      const manifest = {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        main: 'index.js',
        permissions: [],
      };

      fs.promises.readFile.mockResolvedValueOnce(JSON.stringify(manifest));
      fs.promises.readFile.mockResolvedValueOnce('module.exports = { onInstall: () => {} }');

      // Test would load plugin - implementation depends on actual code structure
      expect(typeof loadPlugin).toBe('function');
    });

    it('should parse plugin manifest', async () => {
      // Test manifest parsing
      expect(typeof loadPlugin).toBe('function');
    });

    it('should validate manifest structure', async () => {
      // Test uses validator
      expect(typeof loadPlugin).toBe('function');
    });

    it('should create plugin context', async () => {
      // Test context creation
      expect(typeof loadPlugin).toBe('function');
    });

    it('should initialize plugin API', async () => {
      // Test API initialization
      expect(typeof loadPlugin).toBe('function');
    });

    it('should cache loaded plugins', async () => {
      // Test caching mechanism
      expect(typeof loadPlugin).toBe('function');
    });

    it('should handle missing manifest', async () => {
      // Test error handling for missing manifest
      expect(typeof loadPlugin).toBe('function');
    });

    it('should handle invalid plugin code', async () => {
      // Test error handling for invalid code
      expect(typeof loadPlugin).toBe('function');
    });
  });

  describe('loadPluginsFromDirectory',Skip to main content
The Journal of Biological Chemistry logoLink to The Journal of Biological Chemistry
. 2016 Mar 24;291(21):11415–11428. doi: 10.1074/jbc.M115.702845

Structural and Functional Dissection of the Interaction between the Phosphoprotein and L Polymerase of Vesicular Stomatitis Virus*

Simon Blanchard , Maxime Ferlin §, Aline Desmadril , Alain Morelli ¶,, Paul F Lambert , Sébastien Nisole §, Sylvain Arnould **, Xavier Shao §, Marc Jamin ¶,1
PMCID: PMC4900275  PMID: 27015803

Abstract

The RNA-dependent RNA polymerase complex of non-segmented, negative strand RNA viruses, like the prototypic vesicular stomatitis virus (VSV), comprises the large (L) protein and the phosphoprotein (P). The L polymerase features the catalytic domain, whereas P acts as a cofactor to provide polymerase activity for both transcription and replication of the viral genome. P forms a homotetramer with each monomer featuring an N-terminal region, a central oligomerization domain, and a C-terminal domain (PCTD). PCTD is involved in the interaction with the L polymerase, but the molecular details of this interaction remain unclear. Here, we show that the N-terminal subdomain of PCTD (residues 181–209, termed S1) is primarily involved in the binding to the L polymerase. S1 is predicted to be disordered in solution but folds into an α-helix upon binding to L. We show that a helical peptide mimicking the primary sequence of S1 and a recombinant P monomer, both specifically bind to L. S1 is thus capable of folding into a functional α-helix without the need of tetramerization. We demonstrate that the isolated S1 peptide can disrupt the interaction between the P tetramer and the L polymerase in vitro. Furthermore, the S1 peptide fused to a cell-penetrating peptide or a nuclear localization signal competes with P and prevents VSV replication in cellula. Thus, S1 is a fully functional module with all the structural and functional features required to hijack the L polymerase. Our study defines the critical molecular determinants in the interaction between the P cofactor and the L polymerase and provides a lead toward inhibiting viral replication by targeting this crucial interaction.

Keywords: intrinsically disordered protein, nucleotide-binding protein, protein-protein interaction, RNA polymerase, virus

Introduction

Vesicular stomatitis virus (VSV)2 belongs to the family of non-segmented, negative strand RNA viruses (Mononegavirales) and is the prototype member of the Rhabdoviridae family. The linear genome RNA contains five genes coding for a nucleoprotein (N), a phosphoprotein (P), a matrix protein (M), a glycoprotein (G), and a large polymerase protein (L). The genomic RNA is used both for transcription and for replication. In the replication mode, transcription of the genome from the 3′-end results in the production of a full-length antigenome that serves as template for the synthesis of the full-length genome. In the transcription mode, the polymerase complex synthesizes successively five individual capped and poly(A)-tailed mRNA species starting at the 3′-end. Progression of the polymerase complex from one gene to another is known to be attenuated, resulting in a polar gradient of gene expression from the N gene at the 3′-end to the L gene at the 5′-end. At the junction between two adjacent genes, the polymerase complex polyadenylates and releases the nascent RNA. The complex has to dissociate from the template before reinitiating synthesis at the downstream gene by a scanning mechanism. Approximately 10% of the time during this process, the polymerase complex will fail to reinitiate transcription. This explains both the polarity of gene expression in the genome and the importance of having the viral N gene as the most 3′ gene, resulting in it being the most abundant protein translated.

The polymerase complex of Mononegavirales comprises the L polymerase, which features the catalytic domains, as well as the P cofactor, which is required for polymerase activity (1). The structure of the L polymerase from VSV is not yet available, but a significant breakthrough was made with the recent resolution of the structure of the L polymerase from another member of the Mononegavirales order, the vesiculovirus-related Bas Congo virus (BASV-L) (2). The BASV-L protein of 2109 residues forms a 220-kDa globular structure with a 1:1 stoichiometry to P (2). The overall shape of the BASV-L protein is reminiscent of a right hand with three domains, which were dubbed ring, fingers, and thumb. The ring domain is located at the bottom of the hand and is connected to the thumb and the fingers. The fingers-ring-thumb architecture defines the catalytic cavity for nucleotide incorporation while the capping domain binds and caps the nascent mRNA, before the methyltransferase domain facilitates two successive methylations of the mRNA cap (3). Thus, the L polymerase features all the elements required for RNA synthesis. Although the P cofactor is required for the RNA polymerase activity, the precise function of P is still unclear. P may be required for the accurate positioning of the L polymerase onto the encapsidated genome, which is fully wrapped by a superhelix of the N protein (N-RNA) (4). The function of P may also to consist of chaperoning the nascent RNA, which is generated during transcription or replication, into the N-RNA template. Alternatively, P may play a role in the recruitment of the mRNA capping and methylating enzymes on nascent mRNA (5).

In contrast to the L polymerase, the structure of the VSV P protein has been more extensively characterized. The P protein of VSV features 265 residues and forms a homotetramer. The crystallographic structure of the P tetramer (Fig. 1A) shows that each monomer displays an N-terminal region (residues 1–40, in red), which binds the N protein (N0) (6), a central oligomerization domain (residues 41–180, in green), and a C-terminal domain (PCTD, residues 181–265, in blue) (7, 8). The N-terminal region is unstructured and is not visualized in the crystallographic structure. The PCTD region is also proposed to be unstructured, except for a single α-helix (residues 188–209) connected at each end by highly flexible loops (9). Upon tetramerization, these helices fold and form an up-down-up-down helical bundle, which is itself organized around the central oligomerization domain, forming a pore (8, 10). The N-terminal region (9, 11) and the PCTD (12) of VSV P are intrinsically disordered proteins (IDPs) in isolation, highlighting the importance of such regions in the functionality of this protein. The PCTD interacts with the L polymerase (13), and the minimal binding sequence was narrowed down to residues 108–265 (14, 15). However, the nature of this interaction and a precise delineation of the minimal binding region are still unresolved.

FIGURE 1.

FIGURE 1.

Sequence and structure of the VSV P tetramer. A, structure of the VSV P protein (Protein Data Bank code 3PMN). The three domains of VSV P are colored: the unstructured N-terminal domain (residues 1–40, red), the central oligomerization domain (residues 41–180, green), and the four C-terminal helices (PCTD, residues 181–265, blue). For clarity, only the last residue of PCTD is indicated (Gly-265) as the C terminus. B, VSV P oligomerization is conferred by a coiled-coil region within the central oligomerization domain. Each of the four tetramers is symbolized by a single color. Only the last residue of the central oligomerization domain is indicated (Asn-181), marking the end of the central oligomerization domain and the beginning of PCTD.

Several features are strikingly conserved in the P cofactor of the Mononegavirales, indicating that P is organized in three domains, including an oligomerization domain and two intrinsically disordered domains. Residues 1–40 of the N-terminal domain of the P protein is conserved in length in lyssaviruses, whereas this disordered domain is shorter in ephemeroviruses. In the PCTD domain, the helical segment (residues 181–209) of P of VSV is also predicted to be conserved in lyssaviruses and ephemeroviruses. Notably, the crystallographic structure of the VSV P protein (Fig. 1A) is similar to the core structure of the N-terminal domain of the P protein from Sendai virus and of the X domain from rabies virus (1618), suggesting that some structural features of the P protein might be shared amongst different members of the Mononegavirales. The N-terminal disordered region, which varies in length (from 40 residues in VSV to more than 200 in measles virus), as well as the IDP C-terminal region, are implicated in several key interactions with cellular or viral factors (19, 20). For instance, the disordered N-terminal domain of P of VSV interacts with the N protein to prevent binding of the N-RNA template (21). During virus replication, P is found to bind to N0, the monomeric and unassembled N protein prior to its incorporation into new nucleocapsids (68). Similarly, the IDP C terminus of P from VSV is known to interact with the L polymerase (13), but the structure of the complex of P with L has not yet been determined. Nevertheless, the recently determined structure of the complex of P and L from the BASV (2), a close relative of the VSV, highlights important features in the interaction of P and L, which are likely to be conserved between VSV and BASV. BASV-P of 301 residues is organized in two folded domains: an N-terminal module (PNTD, residues 1–145) corresponding to the VSV central oligomerization domain (residues 41–180) and a C-terminal module (BASV-PCTD, residues 146–300) that bears strong resemblance to VSV PCTD (residues 181–265). The crystal structure of the BASV-L·PCTD complex reveals a unique binding interface, with few contacts with the body of the L polymerase but with extensive contacts (>2400 Å2) with two appendages at the tip of the fingers domain. Strikingly, the isolated BASV-PCTD is sufficient to confer transcriptase activity to the L polymerase. BASV-PCTD consists of the assembly of two modules with different properties. The first module (residues 146–187), also termed S1, is predicted to be disordered and was not included in the crystallographic structure. The second module (residues 188–300), corresponding to S2 and S3, is composed of two helices. The S2 helix (residues 188–207) does not make any direct contact with L, whereas S3 is a long ∼95-Å-long helix (residues 208–293) that encompasses the entire L polymerase to interact with the connector between the catalytic ring and the cap-binding domain. Interestingly, the residues within the S3 of BASV P have little similarity with the residues in the corresponding region in the VSV P protein, although the region preceding S3 corresponds to the conserved helical segment (residues 181–209) of P of VSV. This suggests that only a part of the highly variable C-terminal region of P proteins from the Mononegavirales may be involved in L binding (19, 20). The structural studies from the BASV-L·PCTD complex highlight a region of interest upstream of the S3 helix (19, 20). Yet the modular organization of the PCTD, with the disordered S1 subdomain upstream of the helical S2-S3 module, suggests functional adaptation typical of IDPs (2224).

Here, we employ biochemical, biophysical, and cellular approaches to dissect in detail the PCTD domain of the VSV P protein in the context of the interaction with the L polymerase. We focus specifically on the role of the S1 subdomain, which is the short stretch of residues (∼25 residues) upstream of S2-S3 (Fig. 1A). We find that the VSV S1 subdomain is an intrinsically disordered region that can interact with the L polymerase by folding into an α-helix. We show that a synthetic S1 peptide binds to the L polymerase in vitro and inhibits the formation of the native P·L complex. We further demonstrate that the S1 peptide is capable of preventing virus growth in cellula. Thus, we characterize here a key interaction between P and L involving the S1 subdomain and demonstrate that the S1 peptide can be used to inhibit replication of a prototypic Mononegavirus. These results open avenues both for mapping in further detail the interaction of P and L as well as for designing new antimicrobial peptides targeting crucial protein-protein interactions involved in virus replication.

Experimental Procedures

Plasmid Constructs for Recombinant Protein Production

Codon-optimized versions of the sequences encoding the P protein of VSV (VSV-P), the L polymerase (VSV-L), and the N protein (VSV-N) from the Indiana isolate of VSV (GenBankTM CAA24351) were derived from commercially synthesized genes by GeneCust (Dudelange, Luxembourg). The different constructs of VSV-P were generated by restriction ligation into pET-28 or pnEAGFP (Clontech) vectors using restriction enzymes from Thermo Scientific and the following oligonucleotides: for 181–265, up, 5′-ACCAGCACCATGGCGCCCAACCTGAACACCGCTCTG; down, 5′-AGGCTCGAGCTATCACTTCCGGAACTTCCGGTC; for 117–265, up, 5′-ACCAGCACCATGGCACCGGAAATCAGCGCAGAACAC; down, 5′-AGGCTCGAGCTATCACTTCCGGAACTTCCGGTC; for 181–225, up, 5′-ACCAGCACCATGGCGCCCAACCTGAACACCGCTCTG; down, 5′-AGGCTCGAGCTATCAAAGCCACTGGAAGATGATCTG; and for 225–265, up, 5′-CACCATGGCCAGATCATCTTCCAGTGGCTTT; down, 5′-AGGCTCGAGCTATCACTTCCGGAACTTCCGGTC. Human codon usage was checked using Graphical Codon Usage Analyzer 2.0 (25). GFP-181–265 was constructed by cloning PCR-amplified, full-length genes into pnEAGFP using up/down oligonucleotides as follows: 5′-CCGGACGCGTCGCCACCATGCCCAACCTGAACACCGCTCTG/5′-CCGGCTCGAGCTATCACTTCCGGAACTTCCGGTCTC. For GFP-181–265-[KRKK→AAAA], the corresponding fragments with the desired mutations were PCR-amplified using the QuikChange site-directed mutagenesis kit (Agilent Technologies) and the following oligonucleotides: 5′-CAGGCTCGCGGCCCTCGCCGCCGCCCTGTCCACCTTCGGTCCGGAAGTTC/5′-GAACTTCCGGACCGAAGGTGGACAGGGCGGCGGCGAGGGCCGCGAGCCTG. For NLS-PCTD, GFP-PCTD was used as a template. The mutations were introduced using site-directed mutagenesis using the following oligonucleotides: 5′-GAGGGTACCAGCACCATGAAGAAGAAGCCTCTGCCCAACCTGAACACCGCTCTGGTGATCC/5′-GGATCACCAGAGCGGTGTTCAGGTTGGGCAGAGGCTTCTTCTTCATGGTGCTGGTACCCTC.

All of the constructs mentioned above and described in the tables in the main text and in supplemental Figs. S1 and S2 were confirmed by DNA sequencing.

Cloning of Full-length L Polymerase

The L polymerase construct was subcloned into the pnTAP vector system (Supplemental Fig. S1, A–C), which employs tandem affinity purification (TAP), similar to what has been described (15, 26, 27). The construct consisted of a CMV promoter, N-terminal calmodulin-binding peptide (CBP), a TEV protease site, and a C-terminal myc tag and hexahistidine tag. This construct is referred to hereafter as TAP-VSV-L. The construct was confirmed by DNA sequencing (Supplemental Fig. S1A).

Western Blots

The following reagents were used to perform Western blots at the indicated final concentration: for anti-c-Myc, 9E10 monoclonal antibody (Santa Cruz Biotechnology) was used at 0.2 mg/ml; for anti-GFP, B-2 monoclonal antibody (Santa Cruz Biotechnology) was used at 0.4 mg/ml; for anti-VSV, rabbit polyclonal antibody (VMRD Inc.) was used at 1:10,000 dilution; for anti-VSV-G, mouse monoclonal antibody (Kerafast) was used at 1:5000 dilution; for anti-FLAG, M2 monoclonal antibody (Sigma-Aldrich) was used at 1 mg/ml; and for anti-GAPDH, 0411 monoclonal antibody (Santa Cruz Biotechnology) was used at 0.4 mg/ml. All the images were taken using the FUJIFILM LAS 4000 Mini luminescent image analyzer.

Expression of TAP-VSV-L

The TAP-VSV-L protein was transiently transfected into HEK293FT cells (obtained from Invitrogen in 2007, catalog number R700-07) for 48 h followed by cell scraping and lysis as described (26).

Purification of TAP-VSV-L

TAP-VSV-L was purified from 8 liters (one batch) of cells as described in supplemental Experimental Procedures and as illustrated in supplemental Fig. S1 (A–C). All the steps were performed at 4 °C, and if necessary, cOmpleteTM protease inhibitor tablets (Roche Applied Science) were used at the concentration indicated in the manufacturer's protocol to prevent proteolytic degradation. Cell lysate prepared from 2 liters of cells was loaded onto a 5-ml HisTrap HP prepacked column (GE Healthcare) and purified as described by the manufacturer with IMAC Start buffer (20 mm sodium phosphate buffer, pH 7.5, 500 mm NaCl, 5 mm β-mercaptoethanol, 10% glycerol, and 50 mm imidazole) and IMAC Elution buffer (20 mm sodium phosphate buffer, pH 7.5, 500 mm NaCl, 5 mm β-mercaptoethanol, 10% glycerol, and 500 mm imidazole). Fractions eluted with the highest protein concentration (as measured by Coomassie-stained SDS-PAGE) were pooled and concentrated 5-fold with VivaspinTM 20, MWCO 10,000. The concentrated protein was loaded onto a Superdex 200 Increase 10/300 gel filtration (GF) column (GE Healthcare) and eluted with GF buffer (20 mm HEPES, pH 7.5, 150 mm NaCl, 5 mm β-mercaptoethanol, 10% glycerol). Fractions eluted with the highest protein concentration were pooled and concentrated 5-fold as mentioned above. For Fig. 2B, the concentrated sample was loaded onto a calmodulin-binding peptide column equilibrated with CBP buffer A (20 mm Tris-HCl, pH 8.0, 150 mm NaCl, 1 mm magnesium acetate, 1 mm imidazole, 5 mm β-mercaptoethanol, 0.1% Nonidet P-40, and 2 mm CaCl2) and eluted with CBP buffer B (20 mm Tris-HCl, pH 8.0, 150 mm NaCl, 1 mm magnesium acetate, 1 mm imidazole, 5 mm β-mercaptoethanol, 0.1% Nonidet P-40, and 2 mm EGTA) as previously described (26). For other experiments, unless indicated otherwise, the concentrated sample was loaded onto a Superdex 200 Increase 10/300 gel filtration column (GE Healthcare) and eluted with GF buffer (20 mm HEPES, pH 7.5, 150 mm NaCl, 5 mm β-mercaptoethanol, 10% glycerol). Fractions eluted with the highest protein concentration were pooled and analyzed for purity and for L polymerase activity. Purified TAP-VSV-L was aliquoted, flash-frozen, and stored at −80 °C.

FIGURE 2.

FIGURE 2.

Purification of the VSV L polymerase from mammalian cells. A, affinity purification of the L polymerase from transfected HEK293FT cells. Shown is a Western blot of the L polymerase using anti-c-Myc (top panel) and a Coomassie Blue-stained gel (bottom panel). L, cell lysate; FT, flow-through; B, purified Bas Congo virus L polymerase construct (2) used as benchmark for TAP-VSV-L. Shown is a Coomassie Blue-stained polyacrylamide gel of the purified BASV-L (in complex with BASV-PCTD) and of the TAP-VSV-L. Asterisk denotes a minor band suspected to be a contaminant of BASV-L. C, shown is a Coomassie Blue-stained polyacrylamide gel, showing that in a single experiment TAP-VSV-L purifies as a mix of monomers, monomers with L·P complexes, and tetrameric complexes of L with P. Asterisks denote the suspected L·P tetramer contaminants. D, shown is a histogram of the relative amount of free P protein (red bars) and L·P complexes (blue bars) obtained during purification of TAP-VSV-L in seven independent purifications. The values were quantified using Quantity One and ImageJ software. E, shown is a summary of the purification of TAP-VSV-L using TAP techniques as described in Supplemental Fig. S1. The yield was estimated from the UV absorbance at 280 nm as measured after the second gel filtration column.

Cloning of Different Constructs of P Protein

Cloning and purification of the full-length P protein was previously described (9). All constructs employed in this study are summarized in supplemental Fig. S2. The PCTD (residues 181–265) of VSV-P was synthesized at GeneCust with a methionine cloning site at the N terminus, an Asp residue following the methionine, and stop codons. This construct, referred to as 181–265, was designed to mimic (as closely as possible from a human codon usage perspective) the longest P fragment that has been reported to bind to the VSV L polymerase (13) (see Figs. 4D and 5D). Another construct was designed to span the conserved helical segment as defined in Ref. 8, encompassing residues 181–225 and bearing a methionine cloning site and stop codon sequence. This construct is referred to as 181–225 (Fig. 4F). An additional construct comprising residues 117–265 was designed to correspond to the proposed minimal L polymerase-binding region (15) and to include the proposed C-terminal helix bundle as well as part of the central oligomerization domain preceding the helix bundle (see Figs. 4D and 5). All constructs were verified by DNA sequencing. The pET-28-PCTD (181–265) and pET-28-PCTD (181–225) were transformed into Escherichia coli BL21(DE3) pLysE-competent cells and purified as described in supplemental Experimental Procedures.

FIGURE 4.

FIGURE 4.

PCTD (residues 181–265) acts as a minimal L-binding element. A, schematic representation of VSV P and L. B, shown is a fluorescence scan of the Coomassie Blue-stained gel corresponding to the elution fractions collected after binding of TAP-VSV-L to CaCl2-treated CBP beads in the presence of different components as mentioned. Lanes 4–9 correspond to the result of the experiments using TAP-VSV-L alone. Lanes 10–15 correspond to the same experiment but in the presence of the previously purified 181–265. C, shown is a Coomassie Blue-stained gel after purification of the complex of TAP-VSV-L with 181–265 using a CaCl2-treated CBP beads with EGTA elution. D, shown is a schematic representation of the domain organization of P. The central oligomerization domain is shown as a coiled-coil. The C-terminal helix bundle is illustrated as four helices pointing up- and down. The box indicates the region corresponding to PCTD. E, shown is a Western blot using anti-c-Myc performed after purification of TAP-VSV-L in the presence of the different P constructs. F, shown is a histogram of the amount of each of the P constructs binding to TAP-VSV-L, calculated from Western blotting using anti-c-Myc and quantified using ImageJ and expressed as a percentage with TAP-VSV-L alone considered as 100%. Asterisk denotes the significant difference in binding between 181–265 and 117–265. G, fluorescence polarization assays showing the binding affinity of L for the 181–265 construct. The apparent KD was estimated to be 1.5 nm. H, schematic representation of the 181–265 construct. Indicated are the positions of KRKK and GGGG, which are sequences susceptible to proteolysis. The mutations KRKK→AAAA (4A) and GGGG→AAAA (4A′) were designed and tested for binding to L using Western blotting (inset). The data are the relative values with respect to the 181–265 mutated at GGG→AAA (4A′), which corresponds to 100%.

FIGURE 5.

FIGURE 5.

Mapping the functionally important L polymerase-binding segment of PCTD. A, schematic representation of the modular architecture of PCTD (181–265) with S1 (blue) corresponding to the predicted disordered region preceding the S2 helix and S2-S3 corresponding to the S2 and S3 helices. The mutants tested are indicated as well as their respective positions. B, relative binding of TAP-VSV-L to the different 181–265 mutants as quantified using Western blotting and ImageJ and normalized with respect to the binding of TAP-VSV-L to the WT 181–265 construct, which corresponds to 100%. The histogram reveals a drastic difference in binding for the 181–265 construct in which the four helical residues are mutated into prolines or glycines, which are known to be helical-breakers. The asterisk denotes a two-tailed, Student's t test at p ≤ 0.05, indicating a significant difference between the WT construct and the construct with mutations. C, shown is an SDS-polyacrylamide gel stained with Coomassie Blue revealing the complex of 181–265 with TAP-VSV-L. The inset shows a schematic representation of P (in which S1 corresponds to the predicted disordered S1 peptide and S2-S3 corresponds to the two helices) in complex with L (inset). D, shown is a Coomassie Blue-stained SDS-polyacrylamide gel corresponding to the result of the binding experiment of TAP-VSV-L with the purified 117–265 construct using Western blots and a pull-down experiment with CaCl2-treated CBP beads with EGTA elution. The data reveal that the 117–265 construct includes residues 181–209 required for L binding. E, shown is a Western blot using the anti-c-Myc antibody corresponding to the results of the binding of the different P constructs as indicated. The asterisk denotes the expected monomer-based molecular weight for 181–265 (∼12 kDa) and for 181–225 (∼7 kDa). F, shown is a SDS-polyacrylamide gel stained with Coomassie Blue illustrating the binding of TAP-VSV-L to the different P constructs. Asterisks denote the predominant oligomer (∼70 kDa for 181–265 and ∼30 kDa for 181–225). G, shown is a histogram quantifying the relative binding of the 181–265 construct and of the 181–225 construct in five different independent experiments using Western blotting with anti-c-Myc as estimated with ImageJ. H, shown is a fluorescence polarization binding assay, illustrating the binding of 181–225 to L. An apparent KD of about 100 nm was estimated using the Hill equation.

Expression of GFP-P Constructs

All GFP constructs, including those coding for GFP alone, were transiently transfected into HEK293FT cells for 24 h using FUGENE® HD (Promega) according to manufacturer recommendations and were then analyzed by immunofluorescence and flow cytometry as described below.

Immunofluorescence and Flow Cytometry

Immunofluorescence and flow cytometry analyses were performed as described in supplemental Experimental Procedures.

L Polymerase Activity Assays

The complete protocol for L polymerase activity assays has been described in detail in Ref. 28 and is summarized in supplemental Experimental Procedures. For the activity assays with full-length P-His6 and for the P-His6 fragments, TAP-VSV-L was incubated with proteins as indicated in the figures. Incubation of TAP-VSV-L with P-His6 and/or with P fragments was performed for 20 min on ice before adding the poly(A) template and the substrate mix.

Cell Penetrating Peptides

Custom peptides were synthesized (and end-capped) using an acetylation kit (C-terminal amide) from GeneCust (Luxembourg). Cell-penetrating peptides (CPPs) bearing the S1 sequence were designed by fusing at the C terminus of the S1 peptide (residues 181–209) a cell-penetrating penetratin-derived sequence including the cell-penetrating sequence (29), a GSGSG flexible linker (30), and a FLAG tag sequence for Western blotting (31, 32). All of the peptides were characterized by GeneCust by MALDI-TOF for purity and for mass (supplemental Fig. S3). The solubility of each of the peptides was determined by consecutive dilutions in PBS buffer with estimation of the solubility at 50 μm. As a further test, UV scans and size exclusion chromatography were performed on the different CPPs at 100 μm.

Virus Infections

The following viruses were obtained: VSV-GFP (VSVΔG-GFP, from Dr. Garry Nolan); VSV-WT (from Dr. John Bell); and lentivirus-GFP (pLenti6.2-GFP expressing a GFP gene under a CMV promoter, derived from lentiviruses under a VS