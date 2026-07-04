import type { Citation } from '@fasl-work/caos-app-shell';

// The references PitForge's methodology rests on, ultimate-pit OR + open-pit design.
export const CITATIONS: Citation[] = [
  {
    id: 'lerchs1965',
    label: 'Lerchs & Grossmann 1965',
    citation: 'Lerchs, H. & Grossmann, I. F. (1965). Optimum design of open-pit mines. CIM Bulletin, 58, 47–54.',
  },
  {
    id: 'picard1976',
    label: 'Picard 1976',
    citation: 'Picard, J.-C. (1976). Maximal closure of a graph and applications to combinatorial problems. Management Science, 22(11), 1268–1272.',
    doi: '10.1287/mnsc.22.11.1268',
  },
  {
    id: 'hochbaum2008',
    label: 'Hochbaum 2008',
    citation: 'Hochbaum, D. S. (2008). The pseudoflow algorithm: a new algorithm for the maximum-flow problem. Operations Research, 56(4), 992–1009.',
    doi: '10.1287/opre.1080.0524',
  },
  {
    id: 'dinic1970',
    label: 'Dinic 1970',
    citation: 'Dinic, E. A. (1970). Algorithm for solution of a problem of maximum flow in networks with power estimation. Soviet Mathematics Doklady, 11, 1277–1280.',
  },
  {
    id: 'whittle1988',
    label: 'Whittle 1988',
    citation: 'Whittle, J. (1988). Beyond optimization in open pit design. In Proc. Canadian Conf. on Computer Applications in the Mineral Industry, 331–337.',
  },
  {
    id: 'hustrulid2013',
    label: 'Hustrulid et al. 2013',
    citation: 'Hustrulid, W., Kuchta, M. & Martin, R. (2013). Open Pit Mine Planning and Design (3rd ed.). CRC Press.',
  },
  {
    id: 'espinoza2013',
    label: 'Espinoza et al. 2013 (MineLib)',
    citation: 'Espinoza, D., Goycoolea, M., Moreno, E. & Newman, A. (2013). MineLib: a library of open pit mining problems. Annals of Operations Research, 206, 93–114.',
    doi: '10.1007/s10479-012-1258-3',
  },
  {
    id: 'caccetta2003',
    label: 'Caccetta & Hill 2003',
    citation: 'Caccetta, L. & Hill, S. P. (2003). An application of branch and cut to open pit mine scheduling. Journal of Global Optimization, 27, 349–365.',
    doi: '10.1023/A:1024835022186',
  },
];
